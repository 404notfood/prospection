"use client";

import type { Prospect } from "@/lib/domain/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { FormField, SelectField } from "@/components/shared/form-field";
import { Switch } from "@/components/ui/switch";
import { statusLabels, presenceLabels } from "@/lib/domain/prospects";

export function ProspectIdentity({
  draft,
  setDraft,
}: {
  draft: Prospect;
  setDraft: (p: Prospect) => void;
}) {
  const { data } = useWorkspace();
  const field = <K extends keyof Prospect>(key: K, value: Prospect[K]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <div className="space-y-4">
      <FormField
        label="Entreprise"
        value={draft.name}
        onChange={(v) => field("name", v)}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Activité"
          value={draft.activity}
          onChange={(v) => field("activity", v)}
          required
        />
        <FormField label="Ville" value={draft.city} onChange={(v) => field("city", v)} required />
      </div>
      <FormField label="Adresse" value={draft.address} onChange={(v) => field("address", v)} />
      <FormField
        label="SIREN"
        value={draft.siren}
        onChange={(v) => field("siren", v)}
        hint="9 chiffres si disponibles. Utilisé pour éviter les doublons."
      />
      <SelectField
        label="Campagne"
        value={draft.campaignId}
        onChange={(v) => field("campaignId", v)}
      >
        <option value="">Sans campagne</option>
        {data.campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Email professionnel"
        type="email"
        value={draft.email}
        onChange={(v) => field("email", v)}
        placeholder="Uniquement si identifié"
      />
      <FormField
        label="Téléphone"
        type="tel"
        value={draft.phone}
        onChange={(v) => field("phone", v)}
      />
      <FormField
        label="Site officiel"
        type="url"
        value={draft.website}
        onChange={(v) => field("website", v)}
        placeholder="https://…"
        linkLabel="Voir le site"
      />
      <FormField
        label="Fiche Google Business Profile"
        type="url"
        value={draft.googleBusinessUrl}
        onChange={(v) => field("googleBusinessUrl", v)}
        placeholder="https://maps.google.com/…"
        linkLabel="Voir la fiche Google"
      />
    </div>
  );
}

export function ProspectQualification({
  draft,
  setDraft,
}: {
  draft: Prospect;
  setDraft: (p: Prospect) => void;
}) {
  const field = <K extends keyof Prospect>(key: K, value: Prospect[K]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <div className="space-y-4">
      <SelectField
        label="Présence numérique"
        value={draft.presence}
        onChange={(v) => field("presence", v as Prospect["presence"])}
      >
        {Object.entries(presenceLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Date de vérification"
        type="date"
        value={draft.verifiedAt}
        onChange={(v) => field("verifiedAt", v)}
      />
      <FormField
        label="Lien vers l’audit SEO"
        type="url"
        value={draft.seoAuditUrl}
        onChange={(v) => field("seoAuditUrl", v)}
        placeholder="https://…"
        linkLabel="Voir l’audit SEO"
      />
      <FormField
        label="Faits observés & vérifications"
        multiline
        rows={4}
        value={draft.evidence}
        onChange={(v) => field("evidence", v)}
        placeholder="Identité vérifiée, recherches effectuées, pages consultées…"
        hint="Précisez les faits et les sources. Une absence de résultat reste une observation à une date donnée."
      />
      <FormField
        label="Source des informations"
        value={draft.source}
        onChange={(v) => field("source", v)}
      />
      <FormField
        label="Lien vers la source"
        type="url"
        value={draft.sourceUrl}
        onChange={(v) => field("sourceUrl", v)}
        placeholder="https://…"
        linkLabel="Voir la source"
      />
      <SelectField
        label="Statut de prospection"
        value={draft.status}
        onChange={(v) => field("status", v as Prospect["status"])}
      >
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <FormField
        label="Prochaine relance"
        type="date"
        value={draft.followUpAt}
        onChange={(v) => field("followUpAt", v)}
      />
      <FormField
        label="Notes personnelles"
        multiline
        rows={3}
        value={draft.notes}
        onChange={(v) => field("notes", v)}
      />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-red-100 bg-red-50/40 p-4">
        <div>
          <label htmlFor="opposition" className="text-xs font-medium">
            Opposition à la prospection
          </label>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Bloque les contacts et les relances.
          </p>
        </div>
        <Switch
          id="opposition"
          checked={draft.opposed}
          onCheckedChange={(v) =>
            setDraft({
              ...draft,
              opposed: v,
              status: v ? "declined" : "review",
              followUpAt: v ? "" : draft.followUpAt,
            })
          }
        />
      </div>
    </div>
  );
}
