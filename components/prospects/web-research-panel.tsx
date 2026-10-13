"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import type { Prospect } from "@/lib/domain/schema";
import {
  webCandidateSchema,
  applyWebCandidate,
  type WebCandidate,
} from "@/lib/domain/web-research";
import { mapsSearch, websiteSearch } from "@/lib/domain/urls";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/shared/external-link";

export function WebResearchPanel({
  draft,
  setDraft,
}: {
  draft: Prospect;
  setDraft: (p: Prospect) => void;
}) {
  const { data } = useWorkspace();
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{ query: string; candidates: WebCandidate[] } | null>(null);
  const query = JSON.stringify([draft.name, draft.city, draft.address]);
  const visible = result?.query === query ? result : null;
  const ready = !!draft.name.trim() && !!draft.city.trim();
  async function search() {
    setSearching(true);
    setResult(null);
    try {
      const response = await fetch("/api/web-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, city: draft.city, address: draft.address }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Recherche indisponible.");
      setResult({ query, candidates: webCandidateSchema.array().parse(payload.candidates) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Recherche indisponible.");
    } finally {
      setSearching(false);
    }
  }
  return (
    <div className="mb-5 space-y-3 rounded-lg border bg-muted/30 p-4">
      <p className="text-xs font-medium">Site et fiche Google</p>
      <Button
        size="sm"
        variant="outline"
        onClick={search}
        disabled={searching || !ready || !data.settings.webResearchEnabled}
      >
        {searching ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Search className="size-3.5" />
        )}
        {searching ? "Recherche en cours…" : "Chercher le site et la fiche Google"}
      </Button>
      {!data.settings.webResearchEnabled && (
        <p className="text-[10px] text-muted-foreground">
          Activez Google Places dans les paramètres pour la recherche automatique.
        </p>
      )}
      {ready && (
        <div className="flex flex-wrap gap-3">
          <ExternalLink url={websiteSearch(draft.name, draft.city)}>
            Rechercher le site sur Google
          </ExternalLink>
          <ExternalLink url={mapsSearch(draft.name, draft.city, draft.address)}>
            Vérifier sur Google Maps
          </ExternalLink>
        </div>
      )}
      {visible && (
        <div className="space-y-3" aria-live="polite">
          <p className="text-[10px] text-muted-foreground">
            Résultats Google Maps · Confirmez le nom et l’adresse avant de sélectionner.
          </p>
          {!visible.candidates.length && (
            <p className="text-xs">
              Aucune correspondance trouvée. La présence numérique reste à vérifier.
            </p>
          )}
          {visible.candidates.map((candidate) => (
            <div key={candidate.id} className="space-y-2 rounded-md border bg-background p-3">
              <p className="text-xs font-medium">{candidate.name}</p>
              <p className="text-[10px] text-muted-foreground">{candidate.address}</p>
              <div className="flex flex-wrap gap-3">
                <ExternalLink url={candidate.website}>Voir le site proposé</ExternalLink>
                <ExternalLink url={candidate.googleBusinessUrl}>Voir la fiche Google</ExternalLink>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(applyWebCandidate(draft, candidate, true));
                  setResult(null);
                  toast.info(
                    "Liens ajoutés au formulaire. Enregistrez la fiche pour les conserver.",
                  );
                }}
              >
                Utiliser cette correspondance
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
