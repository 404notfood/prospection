"use client";

import Link from "next/link";
import { Phone, Mail, ArrowUpRight, Check, Radar } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { formatDate } from "@/lib/utils";

export function ActivityFeed() {
  const { data, basePath } = useWorkspace();
  return (
    <section className="panel h-full p-5">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Le fil de votre activité</h2>
        <span className="size-1.5 rounded-full bg-emerald-500" />
      </div>
      <div className="space-y-6">
        {data.events.slice(0, 4).map((event, index) => {
          const Icon =
            event.kind === "call"
              ? Phone
              : event.kind === "email"
                ? Mail
                : event.kind === "discovery"
                  ? Radar
                  : Check;
          return (
            <div className="relative flex gap-3" key={event.id}>
              {index < Math.min(3, data.events.length - 1) && (
                <div className="absolute top-8 bottom-[-24px] left-[14px] w-px bg-border" />
              )}
              <span className="z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-[#f7f9f4] text-emerald-700">
                <Icon className="size-3" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium leading-5">{event.title}</p>
                <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{event.detail}</p>
                <p className="mt-2 text-[9px] text-muted-foreground/70">
                  {formatDate(event.createdAt)} ·{" "}
                  {new Date(event.createdAt).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Paris",
                  })}
                </p>
              </div>
            </div>
          );
        })}
        {!data.events.length && (
          <p className="py-6 text-xs leading-relaxed text-muted-foreground">
            Vos notes, vérifications et prises de contact apparaîtront ici.
          </p>
        )}
      </div>
      <Link
        href={`${basePath}/activite`}
        className="mt-7 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-[10px] font-medium hover:bg-muted"
      >
        Tout l’historique
        <ArrowUpRight className="size-3" />
      </Link>
    </section>
  );
}
