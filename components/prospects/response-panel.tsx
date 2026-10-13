"use client";

import type { Prospect } from "@/lib/domain/schema";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { canContact } from "@/lib/domain/prospects";

export function ResponsePanel({ prospect }: { prospect: Prospect }) {
  const { update, saving } = useWorkspace();
  return (
    <div className="mt-5 space-y-3 rounded-lg border p-4">
      <p className="text-xs font-medium">Résultat de l’échange</p>
      <p className="text-[10px] text-muted-foreground">
        Consigner une réponse arrête les rappels automatiques en cours.
      </p>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["contacted", "Réponse reçue"],
            ["meeting", "Rendez-vous fixé"],
            ["declined", "Refus"],
          ] as const
        ).map(([status, label]) => (
          <Button
            key={status}
            size="sm"
            variant="outline"
            disabled={saving || !canContact(prospect)}
            onClick={() =>
              update((workspace) => {
                const current = workspace.prospects.find((p) => p.id === prospect.id);
                if (!current || current.opposed) return workspace;
                current.repliedAt = new Date().toISOString();
                current.followUpAt = "";
                current.status = status;
                workspace.events.unshift({
                  id: crypto.randomUUID(),
                  prospectId: current.id,
                  campaignId: current.campaignId,
                  kind: "response",
                  title: label,
                  detail: current.name,
                  createdAt: current.repliedAt,
                });
                return workspace;
              }, "Réponse consignée, rappels arrêtés.")
            }
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
