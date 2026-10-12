"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, ScanSearch, UserCheck, Send } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { counts } from "@/lib/domain/prospects";
import { NumberTicker } from "@/components/ui/number-ticker";

export function StatCards() {
  const { data, basePath } = useWorkspace();
  const totals = counts(data.prospects);
  const cards = [
    {
      label: "Entreprises découvertes",
      value: totals.found,
      caption: "Dans votre carnet, sans doublons",
      icon: Building2,
      filter: "all",
      color: "text-stone-600 bg-stone-100",
    },
    {
      label: "À examiner",
      value: totals.review,
      caption: "Une présence numérique à vérifier",
      icon: ScanSearch,
      filter: "review",
      color: "text-amber-700 bg-amber-50",
    },
    {
      label: "Prospects potentiels",
      value: totals.qualified,
      caption: "Retenus après qualification",
      icon: UserCheck,
      filter: "qualified",
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "À contacter",
      value: totals.ready,
      caption: "Prêts pour un premier échange",
      icon: Send,
      filter: "ready",
      color: "text-blue-700 bg-blue-50",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ label, value, caption, icon: Icon, filter, color }) => (
        <Link
          key={label}
          href={`${basePath}/prospects?statut=${filter}`}
          className="panel group p-4 transition-colors hover:border-emerald-300 sm:p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
            <span className={`grid size-8 place-items-center rounded-lg ${color}`}>
              <Icon className="size-4" strokeWidth={1.6} />
            </span>
          </div>
          <div className="my-3 flex items-center justify-between">
            <NumberTicker
              value={value}
              className="text-[36px] font-medium tracking-[-.055em] text-foreground"
              aria-label={`${value} ${label}`}
            />
            <ArrowUpRight className="size-4 text-border transition-colors group-hover:text-emerald-600" />
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{caption}</p>
        </Link>
      ))}
    </div>
  );
}
