"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, basePath } = useWorkspace();
  const [query, setQuery] = useState("");
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, [open, onOpenChange]);
  const results = data.prospects
    .filter((p) => `${p.name} ${p.city} ${p.activity}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 7);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>Un nom, une ville, une opportunité.</DialogTitle>
        <DialogDescription>Recherchez dans votre carnet de prospects.</DialogDescription>
        <div className="relative mt-2">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un prospect…"
            className="pl-10"
            aria-label="Recherche globale"
          />
        </div>
        <div className="space-y-1">
          {results.map((p) => (
            <Link
              onClick={() => onOpenChange(false)}
              href={`${basePath}/prospects?fiche=${p.id}`}
              key={p.id}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-3 hover:bg-muted"
            >
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.activity} · {p.city}
                </p>
              </div>
              <StatusBadge status={p.status} />
              <ArrowUpRight className="size-3 text-muted-foreground" />
            </Link>
          ))}
          {!results.length && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun prospect ne correspond à votre recherche.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
