"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/form-field";
import { ExternalLink } from "@/components/shared/external-link";

export function OpenAiConnection({
  enabled,
  batchSize,
  onChange,
  onBatchSizeChange,
}: {
  enabled: boolean;
  batchSize: number;
  onChange: (enabled: boolean) => void;
  onBatchSizeChange: (size: number) => void;
}) {
  const [configuration, setConfiguration] = useState<{ configured: boolean; model: string } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ai-research", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Connexion indisponible");
        setConfiguration(await response.json());
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, []);
  return (
    <div className="mt-5 space-y-3 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="openai-research" className="text-xs font-medium">
          Recherche avec OpenAI
        </label>
        <Switch
          id="openai-research"
          checked={enabled}
          onCheckedChange={onChange}
          disabled={!configuration?.configured && !enabled}
        />
      </div>
      <p className="text-[11px] leading-6 text-muted-foreground">
        {failed
          ? "État de la connexion indisponible. Rechargez cette page."
          : !configuration
            ? "Vérification de la configuration…"
            : configuration.configured
              ? `Clé détectée · modèle ${configuration.model}. L’activation lance une recherche web IA sur les nouveaux prospects et affiche des propositions avec leurs sources.`
              : "Créez une clé API dans votre projet OpenAI, configurez la facturation API, puis ajoutez OPENAI_API_KEY dans l’environnement du serveur et redémarrez l’application."}
      </p>
      <p className="text-[10px] text-muted-foreground">
        Les appels et recherches web utilisent votre crédit API. L’abonnement ChatGPT est séparé.
        Seuls le nom, l’activité, la ville, l’adresse, le SIREN et le site sont transmis. Les notes,
        emails et identifiants de connexion restent dans votre espace.
      </p>
      <FormField
        label="Prospects analysés par l’IA par lot"
        type="number"
        min={1}
        max={5}
        value={batchSize}
        onChange={(value) => onBatchSizeChange(Number(value))}
        hint="De 1 à 5 pour maîtriser le coût et la durée. Les autres prospects peuvent être analysés depuis leur fiche."
      />
      <ExternalLink url="https://platform.openai.com/api-keys">Créer une clé OpenAI</ExternalLink>
    </div>
  );
}
