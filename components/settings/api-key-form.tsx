"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Provider = "openai" | "google";
export type ConnectionConfiguration = {
  configured: boolean;
  source: "saved" | "server" | "none";
  model: string;
  updatedAt: string;
};

export function useApiConnection(provider: Provider) {
  const [configuration, setConfigurationState] = useState<ConnectionConfiguration | null>(null);
  const [failed, setFailed] = useState(false);
  const setConfiguration = useCallback((value: ConnectionConfiguration) => {
    setConfigurationState(value);
    setFailed(false);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/connections?provider=${provider}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setConfiguration(await response.json());
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [provider, setConfiguration]);
  return { configuration, setConfiguration, failed };
}

export function ApiKeyForm({
  provider,
  configuration,
  onSaved,
}: {
  provider: Provider;
  configuration: ConnectionConfiguration | null;
  onSaved: (configuration: ConnectionConfiguration) => void;
}) {
  const id = useId();
  const [key, setKey] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function action(method: "PUT" | "POST" | "DELETE") {
    setBusy(true);
    try {
      const response = await fetch("/api/connections", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(method === "PUT"
            ? {
                ...(key.trim() ? { apiKey: key.trim() } : {}),
                ...(provider === "openai"
                  ? { model: model ?? configuration?.model ?? "gpt-4.1-mini" }
                  : {}),
              }
            : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Enregistrement indisponible.");
      if (method === "POST") toast.success(result.message);
      else {
        onSaved(result);
        setKey("");
        setModel(null);
        toast.success(
          method === "PUT"
            ? "Connexion enregistrée. Elle est disponible immédiatement."
            : "Clé enregistrée supprimée.",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connexion indisponible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div>
        <Label htmlFor={`${id}-key`} className="field-label">
          Clé API {provider === "openai" ? "OpenAI" : "Google Places"}
        </Label>
        <Input
          id={`${id}-key`}
          type="password"
          autoComplete="new-password"
          spellCheck={false}
          value={key}
          disabled={busy}
          maxLength={2048}
          onChange={(event) => setKey(event.target.value)}
          placeholder={
            configuration?.configured
              ? "Nouvelle clé pour remplacer l’actuelle"
              : "Collez votre clé API"
          }
        />
      </div>
      {provider === "openai" && (
        <div>
          <Label htmlFor={`${id}-model`} className="field-label">
            Modèle OpenAI
          </Label>
          <Input
            id={`${id}-model`}
            value={model ?? configuration?.model ?? "gpt-4.1-mini"}
            disabled={busy}
            maxLength={120}
            onChange={(event) => setModel(event.target.value)}
          />
        </div>
      )}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {configuration?.source === "saved"
          ? "Clé enregistrée et chiffrée. Elle ne sera pas réaffichée."
          : configuration?.source === "server"
            ? "Une clé est déjà configurée sur le serveur. Vous pouvez la remplacer pour votre compte."
            : "La clé est chiffrée côté serveur et reste exclue des exports de prospects."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="text-xs"
          disabled={
            busy ||
            (!key.trim() && !(provider === "openai" && configuration?.configured && model !== null))
          }
          onClick={() => void action("PUT")}
        >
          Enregistrer la clé
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={busy || !configuration?.configured || !!key.trim() || model !== null}
          onClick={() => void action("POST")}
        >
          Vérifier la connexion
        </Button>
        {configuration?.source === "saved" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            disabled={busy}
            onClick={() => void action("DELETE")}
          >
            Supprimer la clé
          </Button>
        )}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {busy
          ? "Traitement en cours…"
          : "Enregistrez ici la clé, puis activez la connexion et enregistrez les paramètres."}
        {provider === "google" &&
          " La vérification effectue une requête Places qui utilise votre quota Google."}
        {configuration?.source === "saved" &&
          " Supprimer cette clé rétablit la configuration du serveur si elle existe."}
      </p>
    </div>
  );
}
