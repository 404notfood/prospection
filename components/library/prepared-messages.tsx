"use client";

import { useState } from "react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { canContact } from "@/lib/domain/prospects";
import { Button } from "@/components/ui/button";
import { MessageComposer } from "@/components/prospects/message-composer";

export function PreparedMessages() {
  const { data } = useWorkspace();
  const [opened, setOpened] = useState("");
  const [limit, setLimit] = useState(10);
  const drafts = data.prospects.filter((p) => p.emailDraft && canContact(p));
  const current = data.prospects.find((p) => p.id === opened);
  return (
    <section className="panel mb-6 space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Brouillons préparés · {drafts.length}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Messages personnalisés enregistrés. Relisez les faits, confirmez le destinataire et
          envoyez depuis votre messagerie.
        </p>
      </div>
      {!drafts.length && (
        <p className="text-xs text-muted-foreground">
          Le parcours automatique préparera ici les messages des prospects retenus.
        </p>
      )}
      {drafts.slice(0, limit).map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3 border-t pt-3">
          <div>
            <p className="text-xs font-medium">
              {p.name} · {p.city}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{p.emailDraft?.subject}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {p.email || "Email à identifier · brouillon disponible"}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpened(p.id)}>
            Relire et envoyer
          </Button>
        </div>
      ))}
      {drafts.length > limit && (
        <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 10)}>
          Afficher les suivants
        </Button>
      )}
      {current && (
        <MessageComposer
          key={current.id}
          prospect={current}
          open={!!opened}
          onOpenChange={(open) => {
            if (!open) setOpened("");
          }}
        />
      )}
    </section>
  );
}
