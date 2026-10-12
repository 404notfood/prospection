import { Brand } from "@/components/shared/brand";
import { LoginForm } from "@/components/auth/login-form";
import { authConfigured } from "@/lib/server/auth";
import { ArrowUpRight, MapPin } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connexion privée" };
export const dynamic = "force-dynamic";
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      <section className="soft-grid relative hidden flex-col justify-between overflow-hidden bg-[#243b2e] p-14 text-white lg:flex">
        <Brand dark />
        <div className="relative z-10">
          <p className="mb-5 text-[10px] font-medium uppercase tracking-[.24em] text-lime-200/60">
            Les belles opportunités sont proches
          </p>
          <h1 className="max-w-lg text-[56px] leading-[1.1] font-medium tracking-[-.06em]">
            Votre prochain client.
            <br />
            <span className="text-lime-200">À portée de rencontre.</span>
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-white/45">
            Découvrez les entreprises autour de vous. Prenez le temps de comprendre leur activité.
            Engagez la conversation.
          </p>
          <div className="relative mt-12 flex h-44 items-center justify-center">
            <div className="absolute size-64 rounded-full border border-lime-200/10" />
            <div className="absolute size-44 rounded-full border border-lime-200/15" />
            <div className="absolute size-24 rounded-full border border-lime-200/20 bg-lime-200/5" />
            <span className="relative grid size-11 place-items-center rounded-xl bg-lime-200 text-[#243b2e]">
              <MapPin className="size-5" />
            </span>
            <span className="absolute top-8 left-[23%] size-2 rounded-full bg-lime-200/60" />
            <span className="absolute right-[20%] bottom-8 size-2 rounded-full bg-lime-200/80" />
            <span className="absolute top-1 right-[30%] size-1.5 rounded-full bg-white/30" />
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[10px] text-white/40">
          <span>Un outil personnel. Une approche humaine.</span>
          <a
            href="https://404notfood.fr"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-lime-200/70"
          >
            404NotFood
            <ArrowUpRight className="size-3" />
          </a>
        </div>
      </section>
      <section className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-12 lg:hidden">
            <Brand />
          </div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.2em] text-primary">
            Votre espace de travail
          </p>
          <h2 className="text-[34px] font-semibold tracking-[-.055em]">
            Content de vous retrouver.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Une vue claire sur vos contacts et vos prochains échanges.
          </p>
          <LoginForm configured={authConfigured()} />
        </div>
      </section>
    </main>
  );
}
