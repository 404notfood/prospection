"use client";

import Link from "next/link";
import { ArrowUpRight, MapPin, Radar, Pause } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { campaignProspects, counts } from "@/lib/domain/prospects";
import { EmptyState } from "@/components/shared/empty-state";

export function CampaignOverview() {
  const { data, basePath } = useWorkspace();
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Vos terrains de prospection</h2>
          <span className="rounded border bg-white px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {data.campaigns.length}
          </span>
        </div>
        <Link
          href={`${basePath}/campagnes`}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
        >
          Toutes les campagnes
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      {data.campaigns.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {data.campaigns.slice(0, 3).map((campaign, index) => {
            const total = counts(campaignProspects(data, campaign.id));
            const progress = total.found
              ? Math.round(((total.found - total.review) / total.found) * 100)
              : 0;
            return (
              <Link
                key={campaign.id}
                href={`${basePath}/campagnes?campagne=${campaign.id}`}
                className="panel group p-5 transition-colors hover:border-emerald-300"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span
                    className={`grid size-8 place-items-center rounded-lg ${index === 0 ? "bg-[#eef2df] text-[#7e8f41]" : index === 1 ? "bg-orange-50 text-orange-600" : "bg-indigo-50 text-indigo-500"}`}
                  >
                    <Radar className="size-4" strokeWidth={1.5} />
                  </span>
                  <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    {campaign.state === "active" ? (
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                    ) : (
                      <Pause className="size-2.5" />
                    )}
                    {campaign.state === "active"
                      ? "En cours"
                      : campaign.state === "paused"
                        ? "En pause"
                        : "Terminée"}
                  </span>
                </div>
                <h3 className="truncate text-[13px] font-semibold tracking-tight">
                  {campaign.name}
                </h3>
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="size-3" />
                  {campaign.city} · {campaign.radius} km <span className="mx-1 opacity-40">/</span>
                  {campaign.activities[0]}
                </p>
                <div className="mt-5 flex items-baseline justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    <b className="text-sm font-semibold text-foreground">{total.found}</b>{" "}
                    entreprises
                  </span>
                  <span className="text-[10px] text-muted-foreground">{progress}% examinées</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    style={{ width: `${progress}%` }}
                    className="h-full rounded-full bg-[#92ae68] transition-all"
                  />
                </div>
                <div className="mt-3 flex justify-between text-[10px]">
                  <span className="text-emerald-700">{total.ready} à contacter</span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Votre première campagne commence ici"
          description="Choisissez une zone, une activité et vos critères de qualification."
        />
      )}
    </section>
  );
}
