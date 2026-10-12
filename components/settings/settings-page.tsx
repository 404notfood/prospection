"use client";

import { useState } from "react";
import { Save, Plug2, ShieldCheck, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { settingsSchema } from "@/lib/domain/schema";
import { BackupPanel } from "./backup-panel";

export function SettingsPage() {
  const { data } = useWorkspace();
  return <SettingsEditor key={JSON.stringify(data.settings)} />;
}

function SettingsEditor() {
  const { data, update, saving } = useWorkspace();
  const [draft, setDraft] = useState(data.settings);
  async function save() {
    const parsed = settingsSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    await update(
      (workspace) => ({ ...workspace, settings: parsed.data }),
      "Paramètres enregistrés",
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="À votre main"
        title="Votre espace. Vos règles."
        description="L’identité, les sources et le rythme de votre prospection."
        actions={
          <Button disabled={saving} onClick={save} className="text-xs">
            <Save className="size-3.5" />
            Enregistrer
          </Button>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="panel space-y-5 p-6">
            <h2 className="text-sm font-semibold">Votre identité</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Votre nom"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />
              <FormField
                label="Nom de l’entreprise"
                value={draft.company}
                onChange={(v) => setDraft({ ...draft, company: v })}
              />
            </div>
            <FormField
              label="Signature des emails"
              multiline
              rows={4}
              value={draft.signature}
              onChange={(v) => setDraft({ ...draft, signature: v })}
              hint="Insérée dans vos modèles avec la variable {{signature}}."
            />
          </section>
          <section className="panel p-6">
            <h2 className="mb-5 text-sm font-semibold">Un rythme maîtrisé</h2>
            <FormField
              label="Taille des lots par défaut"
              type="number"
              min={1}
              max={25}
              value={draft.batchSize}
              onChange={(v) => setDraft({ ...draft, batchSize: Number(v) })}
              hint="Appliquée aux nouvelles campagnes. Les campagnes existantes conservent leur réglage."
            />
            <div className="mt-5 rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Une recherche à la fois en V1.</span> La
              taille du lot définit le nombre d’entreprises récupérées ; elle ne lance pas autant de
              tâches en parallèle.
            </div>
          </section>
          <BackupPanel />
        </div>
        <div className="space-y-6">
          <section className="panel p-6">
            <div className="mb-5 flex items-center gap-2">
              <Plug2 className="size-4 text-primary" />
              <h2 className="text-sm font-semibold">Vos connexions</h2>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <label htmlFor="discovery-source" className="text-xs font-medium">
                  Recherche d’entreprises
                </label>
                <p className="mt-1 text-[10px] text-muted-foreground">Source publique française</p>
              </div>
              <Switch
                id="discovery-source"
                checked={draft.discoveryEnabled}
                onCheckedChange={(v) => setDraft({ ...draft, discoveryEnabled: v })}
              />
            </div>
            <p className="mt-4 text-[11px] leading-6 text-muted-foreground">
              Découverte par ville, rayon et codes NAF. Les sites web, emails et téléphones sont à
              vérifier séparément.
            </p>
            <a
              href="https://recherche-entreprises.api.gouv.fr/docs/"
              target="_blank"
              rel="noreferrer"
              className="mt-2 block text-[10px] text-primary"
            >
              Documentation de la source ↗
            </a>
            <div className="mt-5 space-y-3 border-t pt-5">
              {["Fournisseur IA", "Envoi d’emails intégré", "Audits SEO automatiques"].map(
                (label) => (
                  <div key={label} className="flex justify-between gap-2 text-[10px]">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-muted-foreground/60">Phase ultérieure</span>
                  </div>
                ),
              )}
            </div>
          </section>
          <section className="rounded-xl border bg-[#eff3e8] p-6">
            <ShieldCheck className="mb-4 size-6 text-[#718555]" />
            <h2 className="text-sm font-medium">Un espace personnel et privé</h2>
            <p className="mt-3 text-[11px] leading-6 text-[#7b866c]">
              Accès via BetterAuth. Aucune inscription publique. Les oppositions sont enregistrées
              et bloquent les contacts dans l’interface.
            </p>
            <div className="mt-5 flex items-center gap-2 text-[10px] text-[#718555]">
              <LockKeyhole className="size-3" />
              Données propres à votre compte
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
