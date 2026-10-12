"use client";

import { MapPin, SlidersHorizontal, MessageSquare } from "lucide-react";
import { FormField, SelectField } from "@/components/shared/form-field";
import type { Campaign } from "@/lib/domain/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";

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
            Choisissez votre terrain. La ville et les activités restent propres à chaque campagne.
          </p>
        </div>
        <FormField
          label="Nom de la campagne"
          value={draft.name}
          onChange={(v) => field("name", v)}
          placeholder="Ex. Les artisans de proximité"
          required
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
        <FormField
          label="Activités ciblées"
          value={draft.activities.join(", ")}
          onChange={(v) =>
            field(
              "activities",
              v.split(",").map((a) => a.trim()),
            )
          }
          placeholder="Peinture, menuiserie…"
          hint="Séparez les activités par des virgules."
          required
        />
        <FormField
          label="Codes NAF correspondants"
          value={draft.nafCodes}
          onChange={(v) => field("nafCodes", v.toUpperCase().replace(/\s/g, ""))}
          placeholder="43.34Z,43.32A"
          hint="Nécessaires pour la recherche publique par métier. Ils restent facultatifs pour les ajouts manuels."
        />
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
        <p className="text-base font-medium">{draft.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {draft.city} · {draft.radius} km · {draft.activities.join(", ")}
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
