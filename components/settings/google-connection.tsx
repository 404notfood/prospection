"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "@/components/shared/external-link";

export function GoogleConnection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/web-research", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Connexion indisponible");
        const result = await response.json();
        setConfigured(result.configured === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="google-research" className="text-xs font-medium">
          Sites et fiches Google
        </label>
        <Switch
          id="google-research"
          checked={enabled}
          onCheckedChange={onChange}
          disabled={configured !== true && !enabled}
        />
      </div>
      <p className="text-[11px] leading-6 text-muted-foreground">
        {failed
          ? "État de la connexion indisponible. Rechargez cette page."
          : configured === null
            ? "Vérification de la connexion…"
            : configured
              ? "Google Places configuré. L’activation recherche automatiquement le site et la fiche Google des nouveaux prospects. Les appels utilisent votre quota Google."
              : "Configuration à prévoir : créez un projet Google Cloud, activez Places API (New) et sa facturation, puis ajoutez GOOGLE_PLACES_API_KEY dans l’environnement du serveur et redémarrez l’application. Gardez cette clé privée."}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Les homonymes restent à examiner. Sans résultat, la présence reste inconnue. Les liens de
        recherche manuelle restent disponibles.
      </p>
      <ExternalLink url="https://developers.google.com/maps/documentation/places/web-service/get-api-key">
        Configurer Google Places
      </ExternalLink>
    </div>
  );
}
