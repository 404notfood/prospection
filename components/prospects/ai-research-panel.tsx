"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@/lib/domain/schema";
import {
  aiResearchSchema,
  applyAiResearch,
  researchIdentity,
  researchIdentityKey,
  type AiResearch,
} from "@/lib/domain/ai-research";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/shared/external-link";

export function AiResearchPanel({
  draft,
  setDraft,
}: {
  draft: Prospect;
  setDraft: (p: Prospect) => void;
}) {
  const { data } = useWorkspace();
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<AiResearch | null>(null);
  const ready = !!draft.name.trim() && !!draft.city.trim();
  const key = researchIdentityKey(draft);
  const current =
    result?.identityKey === key
      ? result
      : draft.aiResearch?.identityKey === key
        ? draft.aiResearch
        : null;
  async function search() {
    setSearching(true);
    setResult(null);
    try {
      const response = await fetch("/api/ai-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(researchIdentity(draft)),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analyse IA indisponible.");
      setResult(aiResearchSchema.parse(payload));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analyse IA indisponible.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <div className="mb-5 space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-medium">Assistant de recherche IA</p>
      <Button
        size="sm"
        variant="outline"
        onClick={search}
        disabled={searching || !ready || !data.settings.aiResearchEnabled}
      >
        {searching ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {searching ? "Recherche web IA en cours…" : "Rechercher avec l’IA"}
      </Button>
      {!data.settings.aiResearchEnabled && (
        <p className="text-[10px] text-muted-foreground">
          Activez la connexion OpenAI dans les paramètres.
        </p>
      )}
      {current && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-[10px] text-muted-foreground">
            Analyse du {new Date(current.researchedAt).toLocaleDateString("fr-FR")} · Propositions à
            vérifier.
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{current.summary}</p>
          <div className="flex flex-wrap gap-3">
            <ExternalLink url={current.website}>Site proposé</ExternalLink>
            <ExternalLink url={current.googleBusinessUrl}>Fiche Google proposée</ExternalLink>
          </div>
          {current.sources.map((source, index) => (
            <div key={`${index}-${source.url}`}>
              <ExternalLink url={source.url}>{`[${index + 1}] ${source.title}`}</ExternalLink>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!current.website && !current.googleBusinessUrl}
              onClick={() => {
                setDraft(applyAiResearch(draft, current));
                setResult(null);
                toast.info("Propositions ajoutées. Enregistrez la fiche pour les conserver.");
              }}
            >
              Utiliser les liens proposés
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft({ ...draft, aiResearch: current });
                setResult(null);
                toast.info(
                  "Analyse ajoutée au formulaire. Enregistrez la fiche pour la conserver.",
                );
              }}
            >
              Conserver l’analyse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
