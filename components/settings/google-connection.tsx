"use client";

import { Switch } from "@/components/ui/switch";
import { ExternalLink } from "@/components/shared/external-link";
import { ApiKeyForm, useApiConnection } from "./api-key-form";

export function GoogleConnection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { configuration, setConfiguration, failed } = useApiConnection("google");
  const configured = configuration?.configured ?? null;
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
              : "Créez un projet Google Cloud, activez Places API (New) et sa facturation, puis enregistrez votre clé ci-dessous."}
      </p>
      <ApiKeyForm provider="google" configuration={configuration} onSaved={setConfiguration} />
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
