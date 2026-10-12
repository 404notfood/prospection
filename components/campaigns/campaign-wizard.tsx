"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Radar } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { campaignSchema, type Campaign } from "@/lib/domain/schema";
import { CampaignFields } from "./campaign-fields";
import { cn } from "@/lib/utils";

export function CampaignWizard({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign?: Campaign;
}) {
  const { data, update, saving } = useWorkspace();
  // Dialog children remount at every opening, keeping drafts independent of saved data.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[570px]">
        <WizardForm
          key={campaign?.id || "new"}
          initial={
            campaign || {
              id: crypto.randomUUID(),
              name: "",
              city: "",
              radius: 20,
              activities: [""],
              nafCodes: "",
              criteria: "Aucun site identifié",
              offerId: data.offers[0]?.id || "",
              templateId: data.templates[0]?.id || "",
              batchSize: data.settings.batchSize,
              state: "active",
              createdAt: new Date().toISOString(),
              searchPage: 1,
              searchExhausted: false,
            }
          }
          saving={saving}
          editing={!!campaign}
          onClose={() => onOpenChange(false)}
          onSave={async (draft) =>
            update(
              (workspace) => {
                const original = workspace.campaigns.find((c) => c.id === draft.id);
                const targetChanged =
                  original &&
                  (original.city !== draft.city ||
                    original.radius !== draft.radius ||
                    original.nafCodes !== draft.nafCodes ||
                    original.batchSize !== draft.batchSize);
                const next = targetChanged
                  ? { ...draft, searchPage: 1, searchExhausted: false }
                  : draft;
                workspace.campaigns = original
                  ? workspace.campaigns.map((c) => (c.id === draft.id ? next : c))
                  : [...workspace.campaigns, next];
                workspace.events.unshift({
                  id: crypto.randomUUID(),
                  prospectId: "",
                  campaignId: draft.id,
                  kind: "campaign",
                  title: original ? "Campagne mise à jour" : "Une nouvelle campagne commence",
                  detail: draft.name,
                  createdAt: new Date().toISOString(),
                });
                return workspace;
              },
              campaign ? "Campagne mise à jour" : "Campagne créée",
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}

function WizardForm({
  initial,
  editing,
  saving,
  onSave,
  onClose,
}: {
  initial: Campaign;
  editing: boolean;
  saving: boolean;
  onSave: (draft: Campaign) => Promise<boolean>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  function next() {
    if (step === 0) {
      const parsed = campaignSchema.safeParse(draft);
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
    }
    setStep(step + 1);
  }
  async function submit() {
    const parsed = campaignSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (await onSave(parsed.data)) onClose();
  }
  return (
    <>
      <DialogHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-50 text-primary">
          <Radar className="size-5" />
        </span>
        <DialogTitle className="text-xl tracking-tight">
          {editing ? "Affiner votre campagne" : "Un nouveau terrain à explorer"}
        </DialogTitle>
        <DialogDescription>Trois étapes pour une prospection qui vous ressemble.</DialogDescription>
      </DialogHeader>
      <div className="my-3 flex items-center gap-2">
        {["Ciblage", "Offre & message", "Rythme"].map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex flex-1 items-center gap-2 border-b-2 pb-3 text-[10px]",
              i <= step ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full text-[9px]",
                i <= step ? "bg-primary text-white" : "bg-muted",
              )}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            {label}
          </div>
        ))}
      </div>
      <CampaignFields step={step} draft={draft} setDraft={setDraft} />
      <div className="mt-5 flex justify-between border-t pt-4">
        <Button
          variant="ghost"
          disabled={saving}
          onClick={() => (step ? setStep(step - 1) : onClose())}
        >
          <ArrowLeft className="size-3.5" />
          {step ? "Retour" : "Annuler"}
        </Button>
        {step < 2 ? (
          <Button onClick={next}>
            Continuer
            <ArrowRight className="size-3.5" />
          </Button>
        ) : (
          <Button disabled={saving} onClick={submit}>
            {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer la campagne"}
            <Check className="size-3.5" />
          </Button>
        )}
      </div>
    </>
  );
}
