"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import type { Campaign } from "@/lib/domain/schema";
import type { AutomationJob } from "@/lib/server/jobs";

const labels = {
  queued: "En attente",
  running: "En cours",
  paused: "En pause",
  completed: "Terminé",
  failed: "À reprendre",
  cancelled: "Annulé",
};
export function AutomationPanel({
  campaign,
  onBusy,
}: {
  campaign: Campaign;
  onBusy: (busy: boolean) => void;
}) {
  const { update, refresh, saving } = useWorkspace();
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [online, setOnline] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [config, setConfig] = useState(campaign.automation);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/automation", { cache: "no-store" });
      if (!response.ok) throw new Error("Suivi indisponible. Actualisez la page.");
      const result = (await response.json()) as {
        jobs: AutomationJob[];
        online: boolean;
        usage: { used: number; limit: number };
      };
      setUsage(result.usage);
      setJobs(result.jobs.filter((j) => j.campaignId === campaign.id));
      setOnline(result.online);
      setError("");
      onBusy(
        result.jobs.some(
          (j) => j.campaignId === campaign.id && ["queued", "running"].includes(j.state),
        ),
      );
      await refresh();
    } catch {
      setError("Suivi indisponible. Actualisez la page.");
    }
  }, [campaign.id, onBusy, refresh]);
  useEffect(() => {
    const initial = setTimeout(() => {
      void load();
    }, 0);
    const timer = setInterval(() => {
      void load();
    }, 3000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  async function action(body: object, method: "POST" | "PATCH") {
    setSending(true);
    try {
      const response = await fetch("/api/automation", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action indisponible.");
      await load();
      toast.success(
        method === "POST" ? "Parcours ajouté à la file de traitements." : "Traitement mis à jour.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action indisponible.");
    } finally {
      setSending(false);
    }
  }
  const active = jobs.find((j) => ["queued", "running", "paused"].includes(j.state));
  const current = active || jobs[0];
  return (
    <section className="panel space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">Parcours automatique</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Découverte → vérifications site et Google → qualification → brouillon prêt à relire.
        </p>
        {campaign.companyTarget === "small" && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Cible TPE/PME, 30 salariés maximum. « Traiter les prospects existants » vérifie aussi
            les anciennes fiches et écarte les effectifs supérieurs au plafond et les grands groupes
            avant tout appel Google ou IA. La tranche de 20 à 49 salariés reste à vérifier.
          </p>
        )}
      </div>
      <p className={`text-[11px] ${online ? "text-emerald-700" : "text-amber-700"}`}>
        {online
          ? "Traitements en arrière-plan disponibles."
          : "Worker non détecté. Le démarrage standard de l’application doit lancer le worker ; les tâches restent conservées en attente."}
      </p>
      {error && (
        <p role="status" className="text-xs text-amber-700">
          {error}
        </p>
      )}
      {usage && (
        <p className="text-[10px] text-muted-foreground">
          OpenAI aujourd’hui : {usage.used}/{usage.limit} appels pour votre compte.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={sending || saving || !!active || campaign.state !== "active"}
          onClick={() => action({ campaignId: campaign.id, mode: "discover" }, "POST")}
        >
          Lancer tout le parcours
        </Button>
        <Button
          variant="outline"
          disabled={sending || saving || !!active || campaign.state !== "active"}
          onClick={() => action({ campaignId: campaign.id, mode: "process" }, "POST")}
        >
          Traiter les prospects existants
        </Button>
      </div>
      {current && (
        <div className="space-y-3 rounded-lg bg-muted/40 p-4" role="status">
          <p className="text-xs font-medium">
            {labels[current.state]} ·{" "}
            {current.stage === "discovery"
              ? "Découverte"
              : current.stage === "prospects"
                ? "Vérification et préparation"
                : "Parcours terminé"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {current.added} ajoutés · {current.processed}/{current.ids.length || "…"} examinés ·{" "}
            {current.qualified} retenus · {current.drafts} brouillons · {current.aiCalls}/
            {current.aiLimit} appels IA
          </p>
          {current.error && <p className="text-xs text-amber-700">{current.error}</p>}
          {current.warnings.length > 0 && (
            <details className="text-[11px]">
              <summary>{current.warnings.length} information(s) à examiner</summary>
              {current.warnings.map((warning) => (
                <p key={warning} className="mt-2">
                  {warning}
                </p>
              ))}
            </details>
          )}
          <div className="flex gap-2">
            {["queued", "running"].includes(current.state) && (
              <Button
                size="sm"
                variant="outline"
                disabled={sending}
                onClick={() => action({ id: current.id, action: "pause" }, "PATCH")}
              >
                Mettre en pause
              </Button>
            )}
            {["paused", "failed"].includes(current.state) && (
              <Button
                size="sm"
                variant="outline"
                disabled={sending || campaign.state !== "active"}
                onClick={() => action({ id: current.id, action: "resume" }, "PATCH")}
              >
                Reprendre
              </Button>
            )}
            {["queued", "running", "paused", "failed"].includes(current.state) && (
              <Button
                size="sm"
                variant="ghost"
                disabled={sending}
                onClick={() => action({ id: current.id, action: "cancel" }, "PATCH")}
              >
                Annuler
              </Button>
            )}
          </div>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-medium">
          Planification et limites de cette campagne
        </summary>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor={`schedule-${campaign.id}`} className="text-xs">
              Relancer automatiquement cette campagne
            </label>
            <Switch
              id={`schedule-${campaign.id}`}
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Intervalle (heures)"
              type="number"
              min={1}
              max={168}
              value={config.intervalHours}
              onChange={(v) => setConfig({ ...config, intervalHours: Number(v) })}
            />
            <FormField
              label="Pages maximum par parcours"
              type="number"
              min={1}
              max={10}
              value={config.maxPages}
              onChange={(v) => setConfig({ ...config, maxPages: Number(v) })}
            />
            <FormField
              label="Prospects maximum par parcours"
              type="number"
              min={1}
              max={100}
              value={config.maxProspects}
              onChange={(v) => setConfig({ ...config, maxProspects: Number(v) })}
            />
            <FormField
              label="Appels IA maximum par parcours"
              type="number"
              min={1}
              max={200}
              value={config.maxAiCalls}
              onChange={(v) => setConfig({ ...config, maxAiCalls: Number(v) })}
            />
          </div>
          {(["qualify", "prepareMessages"] as const).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <label htmlFor={`${key}-${campaign.id}`} className="text-xs">
                {key === "qualify"
                  ? "Qualifier les résultats suffisamment vérifiés"
                  : "Préparer les brouillons des prospects retenus"}
              </label>
              <Switch
                id={`${key}-${campaign.id}`}
                checked={config[key]}
                onCheckedChange={(value) => setConfig({ ...config, [key]: value })}
              />
            </div>
          ))}
          <Button
            variant="outline"
            disabled={saving}
            onClick={() =>
              update((workspace) => {
                const found = workspace.campaigns.find((c) => c.id === campaign.id);
                if (found)
                  found.automation = {
                    ...config,
                    nextRunAt:
                      config.enabled !== found.automation.enabled ? "" : found.automation.nextRunAt,
                  };
                return workspace;
              }, "Planification enregistrée.")
            }
          >
            Enregistrer la planification
          </Button>
          {campaign.automation.nextRunAt && (
            <p className="text-[10px] text-muted-foreground">
              Prochaine exécution :{" "}
              {new Date(campaign.automation.nextRunAt).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      </details>
      <p className="text-[10px] text-muted-foreground">
        Les échéances de relance sont suivies automatiquement. Les emails restent des brouillons à
        envoyer manuellement. L’audit SEO reste externe.
      </p>
    </section>
  );
}
