"use client";

import { ArrowUpRight, Mail, Phone, Globe2 } from "lucide-react";
import type { Prospect } from "@/lib/domain/schema";
import { presenceLabels } from "@/lib/domain/prospects";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/status-badge";
import { initials } from "@/lib/utils";
import { ExternalLink } from "@/components/shared/external-link";
import { displayVerification, verificationLabels } from "@/lib/domain/verification";
import { currentCompanySize, employeeRanges } from "@/lib/domain/company-size";

interface TableProps {
  prospects: Prospect[];
  selected: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onOpen: (p: Prospect) => void;
  sort: "asc" | "desc";
  onSort: () => void;
}

export function ProspectTable({ prospects, selected, onSelect, onOpen, sort, onSort }: TableProps) {
  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect(next);
  }
  const allChecked = prospects.length > 0 && prospects.every((p) => selected.has(p.id));
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b bg-[#fafbf8] text-[10px] text-muted-foreground">
          <tr>
            <th className="w-12 px-5 py-4">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(v) => {
                  const next = new Set(selected);
                  prospects.forEach((p) => (v ? next.add(p.id) : next.delete(p.id)));
                  onSelect(next);
                }}
                aria-label="Sélectionner la page"
              />
            </th>
            <th className="min-w-[230px] px-3 font-medium">
              <button onClick={onSort} className="flex items-center gap-2">
                Entreprise <span className="text-[9px]">{sort === "asc" ? "↑" : "↓"}</span>
              </button>
            </th>
            <th className="px-3 font-medium">Localisation</th>
            <th className="min-w-[150px] px-3 font-medium">Présence web</th>
            <th className="px-3 font-medium">Coordonnées</th>
            <th className="px-3 font-medium">Statut</th>
            <th className="px-5">
              <span className="sr-only">Fiche</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prospects.map((p) => (
            <tr key={p.id} className="group border-b last:border-b-0 hover:bg-muted/30">
              <td className="px-5 py-5">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                  aria-label={`Sélectionner ${p.name}`}
                />
              </td>
              <td className="px-3">
                <button onClick={() => onOpen(p)} className="flex items-center gap-3 text-left">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#e3e9dc] bg-[#f0f3e9] text-[10px] font-medium text-[#788b61]">
                    {initials(p.name)}
                  </span>
                  <span>
                    <span className="block text-xs font-medium group-hover:text-primary">
                      {p.name}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {p.activity}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground">
                      {currentCompanySize(p).status === "small"
                        ? "TPE / PME · 30 salariés maximum"
                        : currentCompanySize(p).status === "large"
                          ? "Hors cible · plus de 30 salariés ou GE/ETI"
                          : "Taille à vérifier"}
                      {employeeRanges[currentCompanySize(p).employeeRange]
                        ? ` · ${employeeRanges[currentCompanySize(p).employeeRange]}`
                        : ""}
                    </span>
                  </span>
                </button>
              </td>
              <td className="px-3 text-xs text-muted-foreground">{p.city}</td>
              <td className="px-3">
                <span
                  className={`flex items-center gap-1.5 text-[10px] ${p.presence === "unknown" ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  <Globe2 className="size-3.5" />
                  {presenceLabels[p.presence]}
                </span>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Site : {verificationLabels[displayVerification(p, "website").status]}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Google : {verificationLabels[displayVerification(p, "google").status]}
                </p>
                {p.qualification === "excluded" && (
                  <p className="mt-1 text-[10px] text-amber-700">Hors cible</p>
                )}
                {p.emailDraft && (
                  <p className="mt-1 text-[10px] text-emerald-700">Brouillon prêt</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <ExternalLink url={p.website}>Site</ExternalLink>
                  <ExternalLink url={p.seoAuditUrl}>Audit SEO</ExternalLink>
                  <ExternalLink url={p.googleBusinessUrl}>Fiche Google</ExternalLink>
                </div>
              </td>
              <td className="px-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {p.email && (
                    <span title={p.email}>
                      <Mail className="size-3.5" />
                    </span>
                  )}
                  {p.phone && (
                    <span title={p.phone}>
                      <Phone className="size-3.5" />
                    </span>
                  )}
                  {!p.email && !p.phone && (
                    <span className="text-[10px] text-muted-foreground/50">À compléter</span>
                  )}
                </div>
              </td>
              <td className="px-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-5">
                <button
                  onClick={() => onOpen(p)}
                  aria-label={`Ouvrir ${p.name}`}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                >
                  <ArrowUpRight className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
