"use client";

import Link from "next/link";
import { ArrowUpRight, Mail, Phone, Globe2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { initials, cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

const avatarColors = [
  "bg-[#edf1e3] text-[#7b8d51]",
  "bg-[#f9ede3] text-[#ad805e]",
  "bg-[#edf0f8] text-[#6f82b0]",
  "bg-[#f5edf1] text-[#ad7497]",
];

export function PriorityProspects() {
  const { data, basePath } = useWorkspace();
  const prospects = data.prospects
    .filter((p) => ["ready", "follow-up", "meeting"].includes(p.status) && !p.opposed)
    .slice(0, 5);
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Les prochains échanges</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Un premier contact peut faire toute la différence.
          </p>
        </div>
        <Link
          href={`${basePath}/prospects?statut=ready`}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary"
        >
          Voir tout
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {prospects.length ? (
        <div className="relative overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fafbf8] text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Entreprise</th>
                <th className="px-3 py-3 font-medium">Présence web</th>
                <th className="px-3 py-3 font-medium">Statut</th>
                <th className="px-5 py-3 font-medium">
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {prospects.map((p, index) => (
                <tr key={p.id} className="group border-t hover:bg-muted/40">
                  <td className="px-5 py-4">
                    <Link
                      href={`${basePath}/prospects?fiche=${p.id}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-lg text-[10px] font-medium",
                          avatarColors[index % avatarColors.length],
                        )}
                      >
                        {initials(p.name)}
                      </span>
                      <div>
                        <p className="whitespace-nowrap text-[12px] font-medium group-hover:text-primary">
                          {p.name}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {p.activity} · {p.city}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <Globe2 className="size-3.5" />
                      {p.presence === "absent"
                        ? "Aucun site identifié"
                        : p.presence === "present"
                          ? "Site identifié"
                          : "À vérifier"}
                    </span>
                  </td>
                  <td className="px-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-5">
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      {p.email ? (
                        <Mail className="size-3.5" />
                      ) : p.phone ? (
                        <Phone className="size-3.5" />
                      ) : null}
                      <Link
                        href={`${basePath}/prospects?fiche=${p.id}`}
                        aria-label={`Ouvrir ${p.name}`}
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-5">
          <EmptyState
            title="Chaque contact se prépare"
            description="Qualifiez vos premières entreprises pour les retrouver ici."
          />
        </div>
      )}
      <div className="flex items-center gap-2 border-t bg-[#fafbf8] px-5 py-3 text-[10px] text-muted-foreground">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Les coordonnées restent à confirmer avant tout contact.
      </div>
    </section>
  );
}
