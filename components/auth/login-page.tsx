import { Brand } from "@/components/shared/brand";
import { LoginForm } from "./login-form";
import { getSession } from "@/lib/server/session";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-[410px]">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <section className="panel p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[.18em] text-primary">
            <ShieldCheck className="size-3.5" /> Espace privé
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-.05em]">Connexion</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Retrouvez votre espace de prospection.
          </p>
          <LoginForm />
        </section>
        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          404NotFood · Accès réservé
        </p>
      </div>
    </main>
  );
}
