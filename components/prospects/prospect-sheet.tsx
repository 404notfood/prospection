"use client";

import { useState } from "react";
import { Mail, Phone, ArrowUpRight, Save, ArrowRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@/lib/domain/schema";
import { prospectSchema } from "@/lib/domain/schema";
import { canContact, deduplicate } from "@/lib/domain/prospects";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProspectIdentity, ProspectQualification } from "./prospect-fields";
import { MessageComposer } from "./message-composer";
import { initials, formatDate } from "@/lib/utils";

export function ProspectSheet({
  prospect,
  onClose,
  onNext,
  queueLabel,
}: {
  prospect: Prospect | null;
  onClose: () => void;
  onNext?: () => void;
  queueLabel?: string;
}) {
  return (
    <Sheet
      open={!!prospect}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[570px]">
        {prospect && (
          <ProspectDetail
            key={prospect.id}
            prospect={prospect}
            onClose={onClose}
            onNext={onNext}
            queueLabel={queueLabel}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProspectDetail({
  prospect,
  onClose,
  onNext,
  queueLabel,
}: {
  prospect: Prospect;
  onClose: () => void;
  onNext?: () => void;
  queueLabel?: string;
}) {
  const { data, saving, saveProspect, logEvent } = useWorkspace();
  const [draft, setDraft] = useState(prospect);
  const [compose, setCompose] = useState(false);
  const saved = data.prospects.find((p) => p.id === prospect.id);
  const isNew = !saved;
  const events = data.events.filter((e) => e.prospectId === prospect.id);
  async function save(next = false) {
    const parsed = prospectSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (
      !deduplicate(
        data.prospects.filter((p) => p.id !== draft.id),
        [draft],
      ).length
    ) {
      toast.error("Cette entreprise existe déjà dans votre carnet.");
      return;
    }
    if (await saveProspect(parsed.data)) {
      if (next && onNext) onNext();
      else onClose();
    }
  }
  return (
    <>
      <SheetHeader className="border-b bg-[#fafbf8] px-6 pt-8 pb-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl border bg-white text-sm font-medium text-primary">
            {prospect.name ? initials(prospect.name) : <Building2 className="size-5" />}
          </span>
          <div>
            <SheetTitle className="pr-6 text-lg tracking-tight">
              {isNew ? "Un nouveau contact" : prospect.name}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs">
              {isNew
                ? "Une entreprise, des informations vérifiables."
                : `${prospect.activity} · ${prospect.city}`}
            </SheetDescription>
          </div>
        </div>
        {!isNew && (
          <div className="flex items-center justify-between">
            <StatusBadge status={saved.status} />
            <span className="text-[10px] text-muted-foreground">
              {queueLabel || `Découvert le ${formatDate(prospect.discoveredAt)}`}
            </span>
          </div>
        )}
      </SheetHeader>
      <div className="px-6 py-5">
        {!isNew && (
          <div className="mb-5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!saved.email || !canContact(saved)}
              onClick={() => setCompose(true)}
            >
              <Mail className="size-3.5" />
              Préparer un email
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!canContact(saved) || saving}
              onClick={async () => {
                await logEvent({
                  prospectId: saved.id,
                  campaignId: saved.campaignId,
                  kind: "call",
                  title: "Appel consigné",
                  detail:
                    "Appel réalisé manuellement. Complétez les notes avec le résultat de l’échange.",
                });
              }}
            >
              <Phone className="size-3.5" />
              Consigner un appel
            </Button>
            {saved.sourceUrl && (
              <Button asChild size="sm" variant="ghost">
                <a href={saved.sourceUrl} target="_blank" rel="noreferrer">
                  Source
                  <ArrowUpRight className="size-3" />
                </a>
              </Button>
            )}
          </div>
        )}
        <Tabs defaultValue={isNew ? "identity" : "qualification"}>
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="identity" className="flex-1 text-xs">
              Informations
            </TabsTrigger>
            <TabsTrigger value="qualification" className="flex-1 text-xs">
              Qualification
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-xs">
              Historique
            </TabsTrigger>
          </TabsList>
          <TabsContent value="identity">
            <ProspectIdentity draft={draft} setDraft={setDraft} />
          </TabsContent>
          <TabsContent value="qualification">
            <ProspectQualification draft={draft} setDraft={setDraft} />
          </TabsContent>
          <TabsContent value="history">
            <div className="space-y-5">
              {events.map((event) => (
                <div key={event.id} className="border-l-2 border-emerald-200 pl-4">
                  <p className="text-xs font-medium">{event.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {event.detail}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
              {!events.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  L’histoire de ce contact commence ici.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t bg-white/95 px-6 py-4 backdrop-blur">
        <Button variant="ghost" onClick={onClose}>
          Fermer
        </Button>
        <div className="flex gap-2">
          <Button disabled={saving} onClick={() => save()}>
            <Save className="size-3.5" />
            Enregistrer
          </Button>
          {onNext && (
            <Button variant="secondary" disabled={saving} onClick={() => save(true)}>
              Suivant
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      {saved && compose && (
        <MessageComposer prospect={saved} open={compose} onOpenChange={setCompose} />
      )}
    </>
  );
}
