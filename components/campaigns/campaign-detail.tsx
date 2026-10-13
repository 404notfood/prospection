"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Radar,
  Loader2,
  ScanSearch,
  ArrowUpRight,
  Settings2,
  Pause,
  Play,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Campaign, Prospect } from "@/lib/domain/schema";
import { deduplicate, campaignProspects, counts } from "@/lib/domain/prospects";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { CampaignWizard } from "./campaign-wizard";
import { ProspectSheet } from "@/components/prospects/prospect-sheet";
import { activityFilter } from "@/lib/domain/activities";
import { AutomationPanel } from "./automation-panel";
import { campaignTarget } from "@/lib/domain/automation";
import { campaignSearchLabel } from "@/lib/domain/campaigns";

export function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const { data, update, saving, basePath } = useWorkspace();
  const [searching, setSearching] = useState(false);
  const [edit, setEdit] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const prospects = campaignProspects(data, campaign.id);
  const total = counts(prospects);
  const examined = total.found - total.review;
  const progress = total.found ? Math.round((examined / total.found) * 100) : 0;
  const current = data.prospects.find((p) => p.id === queue[position]) || null;

  async function search() {
    setSearching(true);
    setWarnings([]);
    try {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const result = (await response.json()) as {
        prospects: Prospect[];
        nextPage: number;
        nextOffset: number;
        exhausted: boolean;
        sourceTotal: number;
        warnings?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "La recherche a échoué.");
      setWarnings(result.warnings || []);
      let added = 0;
      const saved = await update((workspace) => {
        const campaignNow = workspace.campaigns.find((c) => c.id === campaign.id);
        if (!campaignNow || campaignTarget(campaignNow) !== campaignTarget(campaign))
          throw new Error(
            "Le ciblage a changé pendant cette recherche. Relancez-la avec la nouvelle configuration.",
          );
        if (
          campaignNow.searchPage !== campaign.searchPage ||
          campaignNow.searchOffset !== campaign.searchOffset
        )
          throw new Error(
            "Une autre recherche a déjà avancé dans cette campagne. Actualisez puis relancez le lot suivant.",
          );
        const unique = deduplicate(workspace.prospects, result.prospects);
        added = unique.length;
        workspace.prospects.push(...unique);
        workspace.campaigns = workspace.campaigns.map((c) =>
          c.id === campaign.id
            ? {
                ...c,
                searchPage: result.nextPage,
                searchOffset: result.nextOffset,
                searchExhausted: c.searchExhausted || result.exhausted,
              }
            : c,
        );
        workspace.events.unshift({
          id: crypto.randomUUID(),
          prospectId: "",
          campaignId: campaign.id,
          kind: "discovery",
          title: "Un nouveau lot découvert",
          detail: `${unique.length} nouvelles entreprises · ${campaign.name}. Résultats de la source à vérifier.`,
          createdAt: new Date().toISOString(),
        });
        return workspace;
      });
      if (saved)
        toast.success(
          `${added} nouvelles entreprises à examiner. Page ${campaign.searchPage} enregistrée.`,
        );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recherche indisponible.");
    } finally {
      setSearching(false);
    }
  }
  function examine() {
    const pending = prospects
      .filter((p) => p.status === "review" && p.qualification !== "excluded" && !p.opposed)
      .slice(0, campaign.batchSize);
    if (!pending.length) {
      toast.info("Toutes les entreprises de cette campagne ont été examinées.");
      return;
    }
    setQueue(pending.map((p) => p.id));
    setPosition(0);
  }
  async function changeState(state: Campaign["state"]) {
    await update(
      (workspace) => ({
        ...workspace,
        campaigns: workspace.campaigns.map((c) => (c.id === campaign.id ? { ...c, state } : c)),
      }),
      state === "active"
        ? "Campagne reprise"
        : state === "paused"
          ? "Campagne en pause"
          : "Campagne terminée",
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Découvertes", total.found],
          ["À examiner", total.review],
          ["Potentielles", total.qualified],
          ["À contacter", total.ready],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-white p-4">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-medium tracking-tight">{value}</p>
          </div>
        ))}
      </div>
      <div className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-label mb-3">Le chemin de votre campagne</p>
            <h3 className="text-lg font-medium tracking-tight">Une étape après l’autre.</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEdit(true)}
            disabled={searching || saving}
          >
            <Settings2 className="size-3" />
            Modifier
          </Button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              title: "Découvrir",
              text: `${campaign.city} · ${campaign.radius} km`,
              extra: campaignSearchLabel(campaign),
            },
            {
              n: "02",
              title: "Vérifier",
              text: campaign.criteria,
              extra: "Identité, site et coordonnées",
            },
            {
              n: "03",
              title: "Échanger",
              text: data.offers.find((o) => o.id === campaign.offerId)?.name || "Offre à définir",
              extra: "Emails et appels manuels",
            },
          ].map((step) => (
            <div key={step.n} className="rounded-lg bg-[#f5f7f1] p-4">
              <span className="text-[10px] font-medium text-[#8b9e74]">
                {step.n} <span className="ml-2 text-foreground">{step.title}</span>
              </span>
              <p className="mt-3 text-xs font-medium">{step.text}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{step.extra}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-between text-[11px]">
          <span className="text-muted-foreground">Qualification des entreprises découvertes</span>
          <span className="font-medium">
            {examined} / {total.found} · {progress}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#88a96b]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={search}
            disabled={
              searching ||
              saving ||
              pipelineBusy ||
              campaign.state !== "active" ||
              campaign.searchExhausted
            }
          >
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Radar className="size-3.5" />
            )}
            {searching
              ? "Recherche en cours…"
              : campaign.searchExhausted
                ? "Source parcourue"
                : `Découvrir les ${campaign.batchSize} suivants`}
          </Button>
          <Button variant="outline" onClick={examine} disabled={!total.review || searching}>
            <ScanSearch className="size-3.5" />
            Examiner un lot
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`${basePath}/prospects?campagne=${campaign.id}`}>
              Voir les prospects
              <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Page de découverte suivante : {campaign.searchPage}. Les doublons sont ignorés à l’import.
          {activityFilter(campaign).codes
            ? ` Filtre NAF ${campaign.nafCodes ? "renseigné" : "automatique"} : ${activityFilter(campaign).codes}.`
            : " Toutes les activités de la zone sont incluses : les métiers restent à vérifier."}
          {data.settings.webResearchEnabled
            ? " Sites et fiches Google recherchés automatiquement ; correspondances à confirmer."
            : " Recherche Google automatique désactivée dans les paramètres."}
          {data.settings.aiResearchEnabled &&
            ` Recherche web IA sur les ${data.settings.aiBatchSize} premiers prospects du lot ; propositions disponibles dans leurs fiches.`}
        </p>
        {warnings.length > 0 && (
          <div
            role="status"
            className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800"
          >
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
      </div>
      <AutomationPanel key={campaign.id} campaign={campaign} onBusy={setPipelineBusy} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4">
        <p className="text-xs text-muted-foreground">
          {campaign.state === "paused"
            ? "Cette campagne est en pause."
            : campaign.state === "completed"
              ? "Cette campagne est terminée."
              : "Vous gardez la main sur le rythme."}
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={saving || searching}
            onClick={() => changeState(campaign.state === "active" ? "paused" : "active")}
          >
            {campaign.state === "active" ? (
              <Pause className="size-3" />
            ) : (
              <Play className="size-3" />
            )}
            {campaign.state === "active" ? "Mettre en pause" : "Reprendre"}
          </Button>
          {campaign.state !== "completed" && (
            <Button
              size="sm"
              variant="ghost"
              disabled={saving || searching}
              onClick={() => changeState("completed")}
            >
              <Check className="size-3" />
              Terminer
            </Button>
          )}
        </div>
      </div>
      <CampaignWizard open={edit} onOpenChange={setEdit} campaign={campaign} />
      <ProspectSheet
        prospect={current}
        onClose={() => setQueue([])}
        queueLabel={`Lot · ${position + 1} sur ${queue.length}`}
        onNext={() => {
          if (position + 1 >= queue.length) {
            setQueue([]);
            toast.success("Lot terminé");
          } else setPosition(position + 1);
        }}
      />
    </div>
  );
}
