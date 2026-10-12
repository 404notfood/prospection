"use client";

import { useState } from "react";
import { Phone, Mail, CalendarClock, Check, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { ProspectSheet } from "@/components/prospects/prospect-sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, today } from "@/lib/utils";
import type { Prospect } from "@/lib/domain/schema";

export function ActivityPage() {
  const { data } = useWorkspace();
  const [opened, setOpened] = useState<Prospect | null>(null);
  const [filter, setFilter] = useState("all");
  const followUps = data.prospects
    .filter((p) => p.followUpAt && !p.opposed && !["won", "declined"].includes(p.status))
    .sort((a, b) => a.followUpAt.localeCompare(b.followUpAt));
  const due = followUps.filter((p) => p.followUpAt <= today()).length;
  const events = data.events.filter((e) => filter === "all" || e.kind === filter);
  return (
    <>
      <PageHeading
        eyebrow="Le lien se cultive"
        title="Ne laissez pas un échange en suspens."
        description="Vos prochaines relances et la mémoire de vos prises de contact."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[390px_1fr]">
        <section className="panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-primary" />
              Les prochains rendez-vous
            </h2>
            <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
              {due} à traiter
            </span>
          </div>
          {followUps.length ? (
            <div className="space-y-3">
              {followUps.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setOpened(p)}
                  className="w-full rounded-lg border p-4 text-left hover:border-primary/30"
                >
                  <div className="flex justify-between gap-2">
                    <p className="text-xs font-medium">{p.name}</p>
                    <ArrowUpRight className="size-3.5 text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {p.city} · {p.activity}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className={`text-[10px] ${p.followUpAt <= today() ? "text-amber-700" : "text-muted-foreground"}`}
                    >
                      {formatDate(`${p.followUpAt}T12:00:00Z`)}{" "}
                      {p.followUpAt < today()
                        ? "· En retard"
                        : p.followUpAt === today()
                          ? "· Aujourd’hui"
                          : ""}
                    </span>
                    <StatusBadge status={p.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Le calendrier est ouvert"
              description="Ajoutez une date de relance à vos fiches pour retrouver vos prochains échanges."
            />
          )}
        </section>
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <h2 className="text-sm font-semibold">La mémoire de vos échanges</h2>
            <div className="flex gap-1">
              {[
                ["all", "Tout"],
                ["email", "Emails"],
                ["call", "Appels"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  variant={value === filter ? "secondary" : "ghost"}
                  size="sm"
                  className="text-[10px]"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="divide-y">
            {events.slice(0, 60).map((event) => {
              const prospect = data.prospects.find((p) => p.id === event.prospectId);
              const Icon = event.kind === "call" ? Phone : event.kind === "email" ? Mail : Check;
              return (
                <div key={event.id} className="flex gap-4 p-5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-primary">
                    <Icon className="size-3.5" />
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium">{event.title}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(event.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {event.detail}
                    </p>
                    {prospect && (
                      <button
                        onClick={() => setOpened(prospect)}
                        className="mt-2 text-[10px] text-primary"
                      >
                        {prospect.name} ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!events.length && (
              <div className="p-5">
                <EmptyState
                  title="Vos premiers échanges arrivent"
                  description="Consignez vos appels et vos emails pour garder un historique fiable."
                />
              </div>
            )}
          </div>
        </section>
      </div>
      <ProspectSheet prospect={opened} onClose={() => setOpened(null)} />
    </>
  );
}
