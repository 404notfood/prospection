"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowUpRight, Sun, ArrowRight, ScanSearch } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { BlurFade } from "@/components/ui/blur-fade";
import { StatCards } from "./stat-cards";
import { CampaignOverview } from "./campaign-overview";
import { PriorityProspects } from "./priority-prospects";
import { ActivityFeed } from "./activity-feed";
import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { counts } from "@/lib/domain/prospects";

export function Dashboard() {
  const { data, basePath } = useWorkspace();
  const [create, setCreate] = useState(false);
  const totals = counts(data.prospects);
  return (
    <>
      <BlurFade duration={0.3} blur="2px">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Sun className="size-3.5 text-[#a5a675]" />
              Bonjour {data.settings.name.split(" ")[0]}, place aux belles opportunités.
            </p>
            <h1 className="text-[32px] leading-tight font-semibold tracking-[-.06em] sm:text-[40px]">
              Votre prospection,
              <br />
              <span className="text-[#8d968b]">au bon endroit.</span>
            </h1>
          </div>
          <Button onClick={() => setCreate(true)} className="h-10 gap-2 px-4 text-xs">
            <Plus className="size-3.5" />
            Nouvelle campagne
          </Button>
        </div>
      </BlurFade>
      <BlurFade delay={0.06} duration={0.3} blur="2px">
        <StatCards />
      </BlurFade>
      <BlurFade delay={0.1} duration={0.35} blur="2px">
        <div className="soft-grid relative mt-6 flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-xl bg-[#293e30] px-6 py-6 text-white">
          <div className="pointer-events-none absolute top-[-70px] right-16 size-56 rounded-full border border-lime-200/10">
            <div className="absolute inset-6 rounded-full border border-lime-200/10" />
            <div className="absolute inset-12 rounded-full border border-lime-200/10" />
          </div>
          <div className="relative flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-lime-300/15 bg-lime-300/10 text-lime-200">
              <ScanSearch className="size-5" strokeWidth={1.5} />
            </span>
            <div>
              <p className="mb-1 text-[9px] font-medium uppercase tracking-[.15em] text-lime-200/70">
                Le prochain petit pas
              </p>
              <h2 className="text-[15px] font-medium tracking-tight">
                {totals.review
                  ? `${totals.review} entreprises attendent votre regard.`
                  : "Votre prochain client commence par une recherche."}
              </h2>
              <p className="mt-1.5 text-[11px] text-white/45">
                {totals.review
                  ? "Vérifiez leur présence en ligne. Gardez les contacts qui ont du sens."
                  : "Définissez une zone et un métier, puis construisez votre carnet."}
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="secondary"
            className="relative border border-white/10 bg-white/10 text-[11px] text-white hover:bg-white/20 hover:text-white"
          >
            <Link href={`${basePath}/${totals.review ? "prospects?statut=review" : "campagnes"}`}>
              {totals.review ? "Examiner les prospects" : "Explorer les campagnes"}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </BlurFade>
      <BlurFade delay={0.14} duration={0.35} blur="2px">
        <CampaignOverview />
      </BlurFade>
      <BlurFade delay={0.18} duration={0.35} blur="2px">
        <div className="mt-7 grid gap-5 2xl:grid-cols-[1fr_320px] xl:grid-cols-[1fr_290px]">
          <PriorityProspects />
          <ActivityFeed />
        </div>
      </BlurFade>
      <div className="mt-6 flex items-center justify-between rounded-lg border border-dashed px-5 py-4">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Tout commence par une offre claire.</span>{" "}
          Retrouvez vos prestations et vos arguments.
        </p>
        <Link
          href={`${basePath}/prestations`}
          className="ml-3 shrink-0 text-primary"
          aria-label="Voir les prestations"
        >
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <CampaignWizard open={create} onOpenChange={setCreate} />
    </>
  );
}
