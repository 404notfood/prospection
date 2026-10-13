"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Download, ChevronLeft, ChevronRight, ScanSearch, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProspectTable } from "./prospect-table";
import { ProspectSheet } from "./prospect-sheet";
import { blankProspect } from "@/lib/domain/defaults";
import { statusLabels } from "@/lib/domain/prospects";
import type { Prospect } from "@/lib/domain/schema";
import { downloadFile, exportProspects } from "@/lib/domain/export";
import { displayVerification, verificationLabels } from "@/lib/domain/verification";

const PAGE_SIZE = 10;

export function ProspectsPage() {
  const { data } = useWorkspace();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(params.get("statut") || "all");
  const [campaign, setCampaign] = useState(params.get("campagne") || "all");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set<string>());
  const [opened, setOpened] = useState<Prospect | null>(null);
  const [dismissedLink, setDismissedLink] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [websiteState, setWebsiteState] = useState("all");
  const [googleState, setGoogleState] = useState("all");
  const [draftOnly, setDraftOnly] = useState(false);
  const linked = !dismissedLink ? data.prospects.find((p) => p.id === params.get("fiche")) : null;
  const filtered = data.prospects
    .filter((p) => {
      const matchesQuery = `${p.name} ${p.city} ${p.activity} ${p.siren}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus =
        status === "all" ||
        (status === "qualified"
          ? !["review", "declined"].includes(p.status) && !p.opposed
          : status === "excluded"
            ? p.qualification === "excluded"
            : p.status === status && (status !== "review" || p.qualification !== "excluded"));
      return (
        matchesQuery &&
        matchesStatus &&
        (campaign === "all" || p.campaignId === campaign) &&
        (websiteState === "all" || displayVerification(p, "website").status === websiteState) &&
        (googleState === "all" || displayVerification(p, "google").status === googleState) &&
        (!draftOnly || !!p.emailDraft)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr") * (sort === "asc" ? 1 : -1));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const active = opened ? data.prospects.find((p) => p.id === opened.id) || opened : linked || null;

  function startBatch() {
    const pending = filtered
      .filter((p) => p.status === "review" && p.qualification !== "excluded" && !p.opposed)
      .slice(0, data.settings.batchSize);
    if (!pending.length) {
      toast.info("Aucune entreprise à examiner dans cette sélection.");
      return;
    }
    setQueue(pending.map((p) => p.id));
    setQueueIndex(0);
    setOpened(pending[0]);
  }
  function close() {
    setOpened(null);
    setDismissedLink(true);
    setQueue([]);
  }
  function next() {
    const nextId = queue[queueIndex + 1];
    if (!nextId) {
      close();
      toast.success("Lot terminé. Les vérifications enregistrées sont conservées.");
      return;
    }
    setQueueIndex(queueIndex + 1);
    setOpened(data.prospects.find((p) => p.id === nextId) || null);
  }
  function exportCsv() {
    const rows = selected.size ? filtered.filter((p) => selected.has(p.id)) : filtered;
    if (!rows.length) {
      toast.info("Aucun prospect à exporter dans cette sélection.");
      return;
    }
    downloadFile(exportProspects(rows), "sillage-prospects.csv", "text/csv;charset=utf-8");
    toast.success(`${rows.length} prospects exportés`);
  }

  return (
    <>
      <PageHeading
        eyebrow="Votre carnet"
        title="Des entreprises. Des possibilités."
        description="Les bonnes informations pour construire les bons échanges."
        actions={
          <>
            <Button variant="outline" className="text-xs" onClick={exportCsv}>
              <Download className="size-3.5" />
              Exporter
            </Button>
            <Button
              className="text-xs"
              onClick={() => {
                setQueue([]);
                setOpened(blankProspect());
              }}
            >
              <Plus className="size-3.5" />
              Ajouter un prospect
            </Button>
          </>
        }
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          ["all", "Tous les prospects"],
          ["review", "À examiner"],
          ["ready", "À contacter"],
          ["follow-up", "À relancer"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => {
              setStatus(value);
              setPage(0);
            }}
            className={`rounded-lg border px-3 py-2 text-[11px] transition-colors ${status === value ? "border-primary/20 bg-primary/5 font-medium text-primary" : "border-transparent text-muted-foreground hover:bg-white"}`}
          >
            {label}
            <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[9px]">
              {
                data.prospects.filter(
                  (p) =>
                    value === "all" ||
                    (p.status === value && (value !== "review" || p.qualification !== "excluded")),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute top-3 left-3 size-3.5 text-muted-foreground" />
            <Input
              aria-label="Rechercher dans les prospects"
              placeholder="Une entreprise, une ville, un métier…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              className="border-0 bg-muted/60 pl-9 text-xs shadow-none"
            />
          </div>
          <select
            aria-label="Filtrer par campagne"
            value={campaign}
            onChange={(e) => {
              setCampaign(e.target.value);
              setPage(0);
            }}
            className="h-9 max-w-[210px] rounded-md border bg-white px-3 text-xs"
          >
            <option value="all">Toutes les campagnes</option>
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer par statut"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            className="h-9 rounded-md border bg-white px-3 text-xs"
          >
            <option value="all">Tous les statuts</option>
            <option value="qualified">Prospects potentiels</option>
            <option value="excluded">Hors cible</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button variant="outline" className="text-[11px]" onClick={startBatch}>
            <ScanSearch className="size-3.5" />
            Examiner un lot
          </Button>
          {(
            [
              ["Site", websiteState, setWebsiteState],
              ["Google", googleState, setGoogleState],
            ] as const
          ).map(([label, value, setValue]) => (
            <select
              key={label}
              aria-label={`Filtrer la vérification ${label}`}
              value={value}
              className="h-9 rounded-md border bg-white px-2 text-xs"
              onChange={(e) => {
                setValue(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">{label} · tous les états</option>
              {Object.entries(verificationLabels).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          ))}
          <Button
            variant={draftOnly ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setDraftOnly(!draftOnly);
              setPage(0);
            }}
          >
            Brouillons prêts
          </Button>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-4 border-b bg-primary/5 px-5 py-3 text-xs">
            <span>{selected.size} sélectionnés</span>
            <button onClick={exportCsv} className="font-medium text-primary">
              Exporter la sélection
            </button>
            <button
              className="ml-auto"
              onClick={() => setSelected(new Set())}
              aria-label="Effacer la sélection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {visible.length ? (
          <ProspectTable
            prospects={visible}
            selected={selected}
            onSelect={setSelected}
            onOpen={(p) => {
              setQueue([]);
              setOpened(p);
            }}
            sort={sort}
            onSort={() => setSort(sort === "asc" ? "desc" : "asc")}
          />
        ) : (
          <div className="p-5">
            <EmptyState
              title="Votre carnet a de la place"
              description={
                query || status !== "all"
                  ? "Essayez d’autres filtres pour retrouver vos entreprises."
                  : "Ajoutez une entreprise ou découvrez un premier lot depuis une campagne."
              }
            />
          </div>
        )}
        <div className="flex items-center justify-between border-t px-5 py-4 text-[10px] text-muted-foreground">
          <span>
            {filtered.length ? currentPage * PAGE_SIZE + 1 : 0}–
            {Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}{" "}
            prospects
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span>
              {currentPage + 1} / {pages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </section>
      <ProspectSheet
        prospect={active}
        onClose={close}
        onNext={queue.length ? next : undefined}
        queueLabel={queue.length ? `Lot · ${queueIndex + 1} sur ${queue.length}` : undefined}
      />
    </>
  );
}
