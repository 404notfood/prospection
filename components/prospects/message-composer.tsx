"use client";

import { useState } from "react";
import { Copy, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@/lib/domain/schema";
import { renderMessage, mailto } from "@/lib/domain/messages";
import { canContact } from "@/lib/domain/prospects";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, SelectField } from "@/components/shared/form-field";

export function MessageComposer({
  prospect,
  open,
  onOpenChange,
}: {
  prospect: Prospect;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, demo, saving, logEvent } = useWorkspace();
  const preferred = data.campaigns.find((c) => c.id === prospect.campaignId)?.templateId;
  const initial = data.templates.find((t) => t.id === preferred) || data.templates[0];
  const [templateId, setTemplateId] = useState(initial?.id || "");
  const [message, setMessage] = useState(
    initial ? renderMessage(initial, prospect, data.settings) : { subject: "", body: "" },
  );
  const allowed = canContact(prospect) && !!prospect.email;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogTitle>Un message, pour {prospect.name}</DialogTitle>
        <DialogDescription>
          Relisez les faits et adaptez le texte avant de l’envoyer.
        </DialogDescription>
        <SelectField
          label="Modèle de départ"
          value={templateId}
          onChange={(value) => {
            setTemplateId(value);
            const template = data.templates.find((t) => t.id === value);
            if (template) setMessage(renderMessage(template, prospect, data.settings));
          }}
        >
          <option value="">Message libre</option>
          {data.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </SelectField>
        <p className="text-xs text-muted-foreground">
          Destinataire :{" "}
          <span className="font-medium text-foreground">
            {prospect.email || "Email non identifié"}
          </span>
        </p>
        <FormField
          label="Objet"
          value={message.subject}
          onChange={(v) => setMessage({ ...message, subject: v })}
        />
        <FormField
          label="Votre message"
          multiline
          rows={12}
          value={message.body}
          onChange={(v) => setMessage({ ...message, body: v })}
        />
        {demo && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Démonstration : les adresses sont fictives. L’ouverture de la messagerie est désactivée.
          </p>
        )}
        {!allowed && (
          <p className="text-xs text-amber-700">
            Un prospect qualifié, sans opposition et avec un email identifié est nécessaire.
          </p>
        )}
        {allowed && prospect.status !== "ready" && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ce prospect a déjà été contacté. Consultez son historique avant un nouvel envoi.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `Objet : ${message.subject}\n\n${message.body}`,
                );
                toast.success("Message copié");
              } catch {
                toast.error("La copie est indisponible dans ce navigateur.");
              }
            }}
          >
            <Copy className="size-3.5" />
            Copier
          </Button>
          <Button
            disabled={!allowed || demo || !message.subject || !message.body}
            onClick={() => {
              window.location.href = mailto(prospect.email, message.subject, message.body);
            }}
          >
            <ExternalLink className="size-3.5" />
            Ouvrir ma messagerie
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
          <p className="max-w-xs text-[10px] leading-relaxed text-muted-foreground">
            L’ouverture de votre messagerie ne signifie pas que l’email a été envoyé. Confirmez
            l’envoi après l’avoir effectué.
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={!allowed || saving}
            onClick={async () => {
              if (
                await logEvent({
                  prospectId: prospect.id,
                  campaignId: prospect.campaignId,
                  kind: "email",
                  title: "Email envoyé manuellement",
                  detail: message.subject,
                })
              )
                onOpenChange(false);
            }}
          >
            <Check className="size-3" />
            Consigner l’envoi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
