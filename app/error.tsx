"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg p-12 text-center">
      <h1 className="text-xl font-semibold">L’espace est momentanément indisponible.</h1>
      <p className="my-4 text-sm text-muted-foreground">
        Vérifiez la connexion et la configuration du stockage, puis réessayez.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
