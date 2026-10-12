"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight, Search, Menu, Command, ShieldCheck } from "lucide-react";
import { Navigation, navigation } from "./navigation";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GlobalSearch } from "./global-search";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { basePath, saving } = useWorkspace();
  const pathname = usePathname();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const item = navigation.find((entry) => entry.path && pathname.startsWith(basePath + entry.path));

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] lg:block">
        <Navigation />
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[280px] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Accédez à vos campagnes, prospects et paramètres.
          </SheetDescription>
          <Navigation close={() => setMobile(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b bg-background/95 px-5 backdrop-blur-md sm:px-9">
          <div className="flex items-center gap-3 text-xs">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-4" />
            </Button>
            <span className="hidden text-muted-foreground sm:block">Espace de travail</span>
            <ChevronRight className="hidden size-3 text-muted-foreground/50 sm:block" />
            <span className="font-medium">{item?.label ?? "Vue d’ensemble"}</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <button
              aria-label="Rechercher un prospect"
              onClick={() => setSearch(true)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Search className="size-4" />
              <span className="hidden md:inline">Rechercher</span>
              <kbd className="hidden items-center gap-0.5 rounded border bg-white px-1.5 py-0.5 text-[9px] md:flex">
                <Command className="size-2.5" />K
              </kbd>
            </button>
            <div className="h-5 w-px bg-border" />
            <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
              <ShieldCheck className="size-3.5 text-emerald-700" />
              {saving ? "Enregistrement…" : "Espace privé"}
            </span>
            <span className="grid size-8 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-800">
              LP
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-9 sm:py-10">
          {children}
          <footer className="mt-10 flex flex-wrap justify-between gap-2 border-t pt-5 text-[10px] text-muted-foreground/70">
            <span>Sillage · Des opportunités, à taille humaine.</span>
            <span>
              Conçu pour 404NotFood <span className="ml-2 text-emerald-600">↗</span>
            </span>
          </footer>
        </main>
      </div>
      <GlobalSearch open={search} onOpenChange={setSearch} />
    </div>
  );
}
