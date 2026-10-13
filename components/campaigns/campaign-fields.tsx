"use client";

import { MapPin, SlidersHorizontal, MessageSquare } from "lucide-react";
import { FormField, SelectField } from "@/components/shared/form-field";
import type { Campaign } from "@/lib/domain/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { activityFilter } from "@/lib/domain/activities";
import { campaignSearchLabel, prepareCampaign } from "@/lib/domain/campaigns";

export function CampaignFields({
  step,
  draft,
  setDraft,
}: {
  step: number;
  draft: Campaign;
  setDraft: (draft: Campaign) => void;
}) {
  const { data } = useWorkspace();
  const field = <K extends keyof Campaign>(key: K, value: Campaign[K]) =>
    setDraft({ ...draft, [key]: value });
  if (step === 0)
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
          <MapPin className="size-5 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Indiquez une ville et un rayon. Aucun métier ni code NAF à renseigner pour une recherche
            large.
          </p>
        </div>
        <FormField
          label="Nom de la campagne (facultatif)"
          value={draft.name}
          onChange={(v) => field("name", v)}
          placeholder={
            draft.city ? `Prospection autour de ${draft.city}` : "Généré à partir de la ville"
          }
        />
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <FormField
            label="Ville de départ"
            value={draft.city}
            onChange={(v) => field("city", v)}
            placeholder="Ex. Rennes"
            required
          />
          <FormField
            label="Rayon (km)"
            type="number"
            min={1}
            max={50}
            value={draft.radius}
            onChange={(v) => field("radius", Number(v))}
          />
        </div>
        <SelectField
          label="Entreprises recherchées"
          value={draft.searchScope}
          onChange={(value) =>
            setDraft({
              ...draft,
              searchScope: value as Campaign["searchScope"],
              ...(value === "all" ? { activities: [], nafCodes: "" } : {}),
            })
          }
        >
          <option value="all">Tous les artisans · tous les métiers</option>
          <option value="targeted">Choisir certains métiers (facultatif)</option>
        </SelectField>
        <SelectField
          label="Taille des entreprises"
          value={draft.companyTarget}
          onChange={(value) => field("companyTarget", value as Campaign["companyTarget"])}
        >
          <option value="small">TPE / PME · 30 salariés maximum</option>
          <option value="all">Toutes les tailles</option>
        </SelectField>
        {draft.companyTarget === "small" && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Les entreprises de plus de 30 salariés et les catégories GE/ETI sont écartées. Le
            contrôle porte sur l’entreprise entière, pas sur son agence locale. La tranche de 20 à
            49 salariés et les effectifs inconnus restent à vérifier ; les recherches et brouillons
            automatiques attendent la confirmation du plafond.
          </p>
        )}
        {draft.searchScope === "all" ? (
          <p className="rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
            Les entreprises actives de la zone sont recherchées sans filtre NAF, pour inclure les
            artisans de tous les métiers. La source peut aussi retourner des commerces ou des
            services : le statut artisanal reste à vérifier.
          </p>
        ) : (
          <div className="space-y-4">
            <FormField
              label="Activités ciblées (facultatif)"
              value={draft.activities.join(", ")}
              onChange={(v) =>
                field(
                  "activities",
                  v
                    .split(",")
                    .map((a) => a.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Peinture, menuiserie…"
              hint="Séparez les métiers par des virgules. Laissez vide pour inclure tous les métiers."
            />
            <FormField
              label="Codes NAF (facultatifs)"
              value={draft.nafCodes}
              onChange={(v) => field("nafCodes", v.toUpperCase().replace(/\s/g, ""))}
              placeholder="43.34Z,43.32A"
              hint={
                draft.nafCodes
                  ? "Ces codes ont priorité sur le filtre automatique."
                  : activityFilter(draft).codes
                    ? `Filtre automatique suggéré pour vos activités : ${activityFilter(draft).codes}.`
                    : "Sans code reconnu, recherche dans la zone toutes activités confondues. Les métiers restent à vérifier."
              }
            />
          </div>
        )}
      </div>
    );
  if (step === 1)
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
          <MessageSquare className="size-5 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Une offre cohérente et un message préparé. Vous gardez la main sur chaque envoi.
          </p>
        </div>
        <SelectField
          label="Critère de qualification"
          value={draft.criteria}
          onChange={(v) => field("criteria", v)}
        >
          <option>Aucun site identifié</option>
          <option>Présence numérique à améliorer</option>
          <option>Qualification manuelle selon les notes</option>
        </SelectField>
        <SelectField
          label="Prestation à proposer"
          value={draft.offerId}
          onChange={(v) => field("offerId", v)}
        >
          <option value="">À choisir plus tard</option>
          {data.offers
            .filter((o) => o.enabled)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.price}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="Modèle d’email"
          value={draft.templateId}
          onChange={(v) => field("templateId", v)}
        >
          <option value="">Sans modèle</option>
          {data.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
          Un champ « site web » vide n’est pas une preuve. Chaque entreprise découverte reste à
          examiner jusqu’à votre vérification.
        </p>
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg bg-muted p-4">
        <SlidersHorizontal className="size-5 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Avancez par petits lots. Les pages découvertes et les fiches examinées sont conservées
          pour reprendre plus tard.
        </p>
      </div>
      <FormField
        label="Entreprises par lot"
        type="number"
        min={1}
        max={25}
        value={draft.batchSize}
        onChange={(v) => field("batchSize", Number(v))}
        hint="De 1 à 25. Ce réglage est distinct du nombre de tâches simultanées."
      />
      <div className="rounded-xl border bg-[#fafbf8] p-5">
        <p className="section-label mb-4">Votre campagne en un regard</p>
        <p className="text-base font-medium">{prepareCampaign(draft).name}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {draft.city} · {draft.radius} km · {campaignSearchLabel(draft)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {draft.companyTarget === "small"
            ? "TPE / PME · 30 salariés maximum"
            : "Toutes tailles d’entreprises"}
        </p>
        <div className="my-4 h-px bg-border" />
        <p className="text-xs">{draft.criteria}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {data.offers.find((o) => o.id === draft.offerId)?.name || "Prestation à choisir"} · Envoi
          manuel
        </p>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        La création de la campagne ne lance aucune recherche ni aucun email. Vous décidez de la
        prochaine étape.
      </p>
    </div>
  );
}
