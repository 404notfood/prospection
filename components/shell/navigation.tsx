"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Radar,
  UsersRound,
  CalendarClock,
  Layers3,
  Mail,
  Settings2,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Brand } from "@/components/shared/brand";
import { cn, today } from "@/lib/utils";

export const navigation = [
  {
    label: "Vue d’ensemble",
    path: "",
    icon: LayoutDashboard,
    group: "workspace",
  },
  { label: "Campagnes", path: "/campagnes", icon: Radar, group: "workspace" },
  {
    label: "Prospects",
    path: "/prospects",
    icon: UsersRound,
    group: "workspace",
  },
  {
    label: "Relances & activité",
    path: "/activite",
    icon: CalendarClock,
    group: "workspace",
  },
  {
    label: "Prestations",
    path: "/prestations",
    icon: Layers3,
    group: "library",
  },
  { label: "Modèles d’email", path: "/messages", icon: Mail, group: "library" },
  {
    label: "Paramètres",
    path: "/parametres",
    icon: Settings2,
    group: "library",
  },
];

export function Navigation({ close }: { close?: () => void }) {
  const { data, basePath } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const due = data.prospects.filter(
    (p) =>
      p.followUpAt &&
      p.followUpAt <= today() &&
      !p.opposed &&
      !["won", "declined"].includes(p.status),
  ).length;

  return (
    <div className="flex h-full flex-col bg-sidebar px-5 py-7 text-sidebar-foreground">
      <Link href={basePath} className="mb-9 px-2" onClick={close}>
        <Brand dark />
      </Link>
      <div className="mb-7 flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[.025] px-3 py-3">
        <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-xs font-medium">
          404
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">404NotFood</p>
          <p className="mt-1 text-[10px] text-white/40">Espace de prospection</p>
        </div>
        <span className="size-1.5 rounded-full bg-lime-300" />
      </div>
      <nav className="flex-1 space-y-7" aria-label="Navigation principale">
        {["workspace", "library"].map((group) => (
          <div key={group}>
            <p className="mb-3 px-3 text-[9px] font-medium uppercase tracking-[.2em] text-white/30">
              {group === "workspace" ? "Votre espace" : "Votre boîte à outils"}
            </p>
            <div className="space-y-1">
              {navigation
                .filter((item) => item.group === group)
                .map(({ label, path, icon: Icon }) => {
                  const active = path
                    ? pathname.startsWith(`${basePath}${path}`)
                    : pathname === basePath;
                  return (
                    <Link
                      key={path}
                      href={`${basePath}${path}`}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] transition-colors",
                        active
                          ? "bg-lime-300 text-[#202923] font-semibold"
                          : "text-white/55 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.7} />
                      <span className="flex-1">{label}</span>
                      {path === "/activite" && due > 0 && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[9px]",
                            active ? "bg-black/10" : "bg-white/10 text-white/70",
                          )}
                        >
                          {due}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-8 rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-lime-300" />
          <span className="text-[10px] font-medium text-white/80">À votre rythme</span>
        </div>
        <p className="text-[11px] leading-relaxed text-white/40">
          Des contacts choisis.
          <br />
          Des échanges qui comptent.
        </p>
        <a
          href="https://404notfood.fr"
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-1.5 text-[10px] text-lime-300"
        >
          Votre site 404NotFood
          <ArrowUpRight className="size-3" />
        </a>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-white/10 px-1 pt-5">
        <span className="grid size-8 place-items-center rounded-full bg-[#445247] text-[10px] font-medium text-lime-200">
          LP
        </span>
        <div className="flex-1">
          <p className="text-[11px] font-medium">{data.settings.name}</p>
          <p className="mt-0.5 text-[9px] text-white/35">Compte privé</p>
        </div>
        {
          <button
            aria-label="Se déconnecter"
            className="text-white/50 hover:text-white"
            onClick={async () => {
              try {
                const response = await fetch("/api/auth/sign-out", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!response.ok)
                  throw new Error("Déconnexion impossible. Réessayez dans un instant.");
                router.push("/connexion");
                router.refresh();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Le serveur n’est pas joignable.",
                );
              }
            }}
          >
            <LogOut className="size-4" />
          </button>
        }
      </div>
    </div>
  );
}
