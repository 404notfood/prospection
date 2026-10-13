"use client";

import { useState } from "react";
import { Mail, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { templateSchema, type EmailTemplate } from "@/lib/domain/schema";
import { renderMessage } from "@/lib/domain/messages";
import { blankProspect } from "@/lib/domain/defaults";
import { cn } from "@/lib/utils";
import { PreparedMessages } from "./prepared-messages";

const variables = [
  "entreprise",
  "ville",
  "activite",
  "constat",
  "nom",
  "societe",
  "signature",
  "prestation",
  "tarif",
  "conditions",
];
export function TemplatesPage() {
  const { data, update, saving } = useWorkspace();
  const [draft, setDraft] = useState<EmailTemplate>(
    data.templates[0] || {
      id: crypto.randomUUID(),
      name: "Nouveau modèle",
      subject: "",
      body: "",
    },
  );
  const sample = {
    ...blankProspect(),
    name: "Votre entreprise exemple",
    city: "Votre ville",
    activity: "Votre métier",
    evidence: "[Un constat vérifié, adapté à cette entreprise.]",
  };
  const preview = renderMessage(draft, sample, data.settings);
  async function save() {
    const parsed = templateSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    await update(
      (workspace) => ({
        ...workspace,
        templates: workspace.templates.some((t) => t.id === draft.id)
          ? workspace.templates.map((t) => (t.id === draft.id ? parsed.data : t))
          : [...workspace.templates, parsed.data],
      }),
      "Modèle enregistré",
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="Les mots justes"
        title="Un point de départ. Votre touche personnelle."
        description="Des modèles que vous adaptez à chaque entreprise, avec des faits vérifiés."
        actions={
          <Button
            className="text-xs"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                name: "Nouveau modèle",
                subject: "",
                body: "Bonjour,\n\n{{signature}}",
              })
            }
          >
            <Plus className="size-3.5" />
            Nouveau modèle
          </Button>
        }
      />
      <PreparedMessages />
      <div className="mb-5 flex flex-wrap gap-2">
        {data.templates.map((template) => (
          <button
            key={template.id}
            onClick={() => setDraft(template)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]",
              draft.id === template.id
                ? "border-primary/30 bg-primary/5 text-primary"
                : "bg-white text-muted-foreground",
            )}
          >
            <Mail className="size-3.5" />
            {template.name}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <section className="panel space-y-5 p-6">
          <FormField
            label="Nom du modèle"
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
          />
          <FormField
            label="Objet de l’email"
            value={draft.subject}
            onChange={(v) => setDraft({ ...draft, subject: v })}
          />
          <FormField
            label="Corps du message"
            multiline
            rows={15}
            value={draft.body}
            onChange={(v) => setDraft({ ...draft, body: v })}
          />
          <div>
            <p className="mb-2 text-[10px] text-muted-foreground">
              Insérer une variable à la fin du message
            </p>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <button
                  key={variable}
                  onClick={() => setDraft({ ...draft, body: `${draft.body}{{${variable}}}` })}
                  className="rounded border bg-muted px-2 py-1 font-mono text-[9px] text-primary"
                >{`{{${variable}}}`}</button>
              ))}
            </div>
          </div>
          <Button onClick={save} disabled={saving}>
            <Save className="size-3.5" />
            Enregistrer le modèle
          </Button>
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b bg-[#f2f5eb] p-5">
            <p className="section-label">Aperçu du message</p>
            <span className="text-[9px] text-muted-foreground">Entreprise fictive</span>
          </div>
          <div className="p-6">
            <div className="space-y-2 border-b pb-5 text-xs">
              <p>
                <span className="inline-block w-10 text-muted-foreground">De</span>
                {data.settings.name} · {data.settings.company}
              </p>
              <p>
                <span className="inline-block w-10 text-muted-foreground">À</span>
                Votre entreprise exemple
              </p>
              <p className="pt-2 font-medium">{preview.subject || "Votre objet apparaît ici"}</p>
            </div>
            <p className="mt-6 whitespace-pre-wrap text-xs leading-7 text-[#52604f]">
              {preview.body}
            </p>
          </div>
          <div className="border-t bg-[#fafbf8] p-5 text-[10px] leading-5 text-muted-foreground">
            Les modèles ne déclenchent aucun envoi. Depuis une fiche prospect, préparez le texte,
            relisez-le et ouvrez votre messagerie.
          </div>
        </section>
      </div>
    </>
  );
}
