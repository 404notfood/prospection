"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const client = createAuthClient();

export function LoginForm() {
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
          result.error.status === 503
            ? "Le service de connexion est momentanément indisponible."
            : "Email ou mot de passe incorrect.",
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
    <form onSubmit={submit} className="mt-7 space-y-5">
      <div>
        <Label htmlFor="email" className="field-label">
          Adresse email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="vous@entreprise.fr"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
          disabled={pending}
        />
      </div>
      <div>
        <Label htmlFor="password" className="field-label">
          Mot de passe
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 pr-11"
            disabled={pending}
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
      <Button type="submit" className="h-11 w-full text-xs" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
