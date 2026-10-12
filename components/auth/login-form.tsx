"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Eye, EyeOff, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const client = createAuthClient();

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await client.signIn.email({ email, password });
      if (result.error) {
        toast.error(
          "Connexion impossible. Vérifiez vos identifiants et la configuration du compte.",
        );
        return;
      }
      router.push("/app");
      router.refresh();
    } catch {
      toast.error("Le serveur n’est pas joignable. Réessayez dans un instant.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="email" className="field-label">
            Votre adresse email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="vous@entreprise.fr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            disabled={!configured}
          />
        </div>
        <div>
          <Label htmlFor="password" className="field-label">
            Votre mot de passe
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
              disabled={!configured}
            />
            <button
              type="button"
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              onClick={() => setVisible(!visible)}
              className="absolute top-3.5 right-3 text-muted-foreground"
            >
              {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="h-11 w-full text-xs" disabled={pending || !configured}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Retrouver mon espace
        </Button>
      </form>
      {!configured && (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] leading-6 text-amber-800">
          Votre accès privé est prêt à être configuré. Renseignez le secret dans{" "}
          <code>.env.local</code>, puis lancez <code>npm run account:setup</code> pour créer votre
          compte.
        </div>
      )}
      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
          Faire un premier tour
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" asChild className="h-11 w-full text-xs">
        <Link href="/demo">
          Explorer la démonstration
          <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
      <p className="mt-6 text-center text-[10px] leading-5 text-muted-foreground">
        Un espace privé, sans inscription publique.
        <br />
        La démonstration utilise uniquement des données fictives.
      </p>
    </>
  );
}
