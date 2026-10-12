"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, MapPin, Radar, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CampaignWizard } from "./campaign-wizard";
import { CampaignDetail } from "./campaign-detail";
import { cn } from "@/lib/utils";

export function CampaignsPage() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const [selected, setSelected] = useState(params.get("campagne") || data.campaigns[0]?.id || "");
  const [create, setCreate] = useState(false);
  const campaign = data.campaigns.find((c) => c.id === selected) || data.campaigns[0];
  return (
    <>
      <PageHeading
        eyebrow="Vos terrains"
        title="Chaque campagne a son cap."
        description="Une zone, des critères clairs et un rythme qui vous convient."
        actions={
          <Button onClick={() => setCreate(true)} className="text-xs">
            <Plus className="size-3.5" />
            Nouvelle campagne
          </Button>
        }
      />
      {campaign ? (
        <div className="grid items-start gap-6 xl:grid-cols-[290px_1fr]">
          <div className="panel overflow-hidden">
            <div className="border-b px-5 py-4">
              <span className="section-label">{data.campaigns.length} campagnes</span>
            </div>
            {data.campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b p-5 text-left last:border-b-0 hover:bg-muted/40",
                  campaign.id === c.id && "bg-[#f1f5eb]",
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-lg border bg-white",
                    campaign.id === c.id ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Radar className="size-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-xs font-medium leading-relaxed">{c.name}</span>
                  <span className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="size-3" />
                    {c.city} · {c.radius} km
                  </span>
                  <span className="mt-3 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        c.state === "active" ? "bg-emerald-500" : "bg-stone-300",
                      )}
                    />
                    {c.state === "active"
                      ? "En cours"
                      : c.state === "paused"
                        ? "En pause"
                        : "Terminée"}
                  </span>
                </span>
                <ChevronRight className="mt-1 size-3 text-muted-foreground" />
              </button>
            ))}
          </div>
          <CampaignDetail key={campaign.id} campaign={campaign} />
        </div>
      ) : (
        <EmptyState
          title="Quel sera votre premier terrain ?"
          description="Choisissez une ville et des métiers, puis construisez une campagne à votre rythme."
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" />
              Créer ma première campagne
            </Button>
          }
        />
      )}
      <CampaignWizard open={create} onOpenChange={setCreate} />
    </>
  );
}
