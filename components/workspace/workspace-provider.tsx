"use client";

import { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  workspaceSchema,
  type Prospect,
  type TimelineEvent,
  type Workspace,
  type WorkspaceSnapshot,
} from "@/lib/domain/schema";
import { qualificationError, validateWorkspace } from "@/lib/domain/prospects";
import { mergeProspectChanges } from "@/lib/domain/merge";
import { followUpDate } from "@/lib/domain/automation";

interface WorkspaceContext {
  data: Workspace;
  saving: boolean;
  basePath: string;
  update: (change: (data: Workspace) => Workspace, message?: string) => Promise<boolean>;
  saveProspect: (prospect: Prospect, before?: Prospect) => Promise<boolean>;
  refresh: () => Promise<void>;
  logEvent: (event: Omit<TimelineEvent, "id" | "createdAt">) => Promise<boolean>;
}
const Context = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: WorkspaceSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [saving, setSaving] = useState(false);
  const current = useRef(initial);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const response = await fetch("/api/workspace", { cache: "no-store" });
    if (!response.ok) return;
    const result = (await response.json()) as WorkspaceSnapshot;
    if (!busy.current && result.revision > current.current.revision) {
      const next = { data: workspaceSchema.parse(result.data), revision: result.revision };
      current.current = next;
      setSnapshot(next);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function update(change: (data: Workspace) => Workspace, message?: string) {
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      const nextData = workspaceSchema.parse(change(structuredClone(current.current.data)));
      const error = validateWorkspace(nextData);
      if (error) throw new Error(error);
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: nextData,
          revision: current.current.revision,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          const latest = await fetch("/api/workspace", { cache: "no-store" });
          if (latest.ok) {
            const snapshot = (await latest.json()) as WorkspaceSnapshot;
            const next = {
              data: workspaceSchema.parse(snapshot.data),
              revision: snapshot.revision,
            };
            current.current = next;
            setSnapshot(next);
          }
        }
        throw new Error(result.error || "La sauvegarde a échoué.");
      }
      const revision: number = result.revision;
      current.current = { data: nextData, revision };
      setSnapshot(current.current);
      if (message) toast.success(message);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "La sauvegarde a échoué.");
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function saveProspect(prospect: Prospect, before?: Prospect) {
    const previous = current.current.data.prospects.find((p) => p.id === prospect.id);
    if (previous && before) {
      try {
        prospect = mergeProspectChanges(previous, before, prospect, true);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Cette fiche a changé.");
        return false;
      }
    }
    const error = qualificationError(
      prospect,
      current.current.data.campaigns.find((c) => c.id === prospect.campaignId),
    );
    if (error) {
      toast.error(error);
      return false;
    }
    return update((data) => {
      data.prospects = previous
        ? data.prospects.map((p) => (p.id === prospect.id ? prospect : p))
        : [prospect, ...data.prospects];
      data.events.unshift({
        id: crypto.randomUUID(),
        prospectId: prospect.id,
        campaignId: prospect.campaignId,
        kind: previous?.status !== prospect.status ? "status" : "note",
        title: previous ? "Fiche mise à jour" : "Prospect ajouté",
        detail: prospect.name,
        createdAt: new Date().toISOString(),
      });
      return data;
    }, "Fiche enregistrée");
  }

  async function logEvent(event: Omit<TimelineEvent, "id" | "createdAt">) {
    return update((data) => {
      data.events.unshift({
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
      if (["call", "email"].includes(event.kind))
        data.prospects = data.prospects.map((p) =>
          p.id === event.prospectId
            ? {
                ...p,
                status: p.status === "ready" ? "contacted" : p.status,
                ...(["ready", "contacted", "follow-up"].includes(p.status) && !p.opposed
                  ? {
                      repliedAt: "",
                      followUpAt:
                        p.followUpAt && p.followUpAt > followUpDate(0)
                          ? p.followUpAt
                          : followUpDate(data.settings.followUpDays),
                    }
                  : {}),
              }
            : p,
        );
      return data;
    }, "Action consignée dans l’historique");
  }

  return (
    <Context.Provider
      value={{
        data: snapshot.data,
        saving,
        basePath: "/app",
        update,
        saveProspect,
        refresh,
        logEvent,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("WorkspaceProvider manquant.");
  return context;
}
