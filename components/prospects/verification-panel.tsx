"use client";

import type { Prospect } from "@/lib/domain/schema";
import { displayVerification, verification, verificationLabels } from "@/lib/domain/verification";
import { ExternalLink } from "@/components/shared/external-link";
import { Button } from "@/components/ui/button";

export function VerificationPanel({
  draft,
  setDraft,
}: {
  draft: Prospect;
  setDraft: (p: Prospect) => void;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {(["website", "google"] as const).map((kind) => {
        const result = displayVerification(draft, kind);
        const url = kind === "website" ? draft.website : draft.googleBusinessUrl;
        return (
          <section key={kind} className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-medium">
              {kind === "website" ? "Site internet" : "Fiche Google Business Profile"}
            </p>
            <p
              className={`text-[11px] font-medium ${result.status === "confirmed" ? "text-emerald-700" : result.status === "uncertain" || result.status === "error" ? "text-amber-700" : "text-muted-foreground"}`}
            >
              {verificationLabels[result.status]}
            </p>
            {result.checkedAt && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(result.checkedAt).toLocaleString("fr-FR")} ·{" "}
                {result.method === "manual"
                  ? "Vérification manuelle"
                  : result.method === "google"
                    ? "Google Places"
                    : "Recherche IA"}
              </p>
            )}
            {result.reason && (
              <p className="text-[10px] leading-relaxed text-muted-foreground">{result.reason}</p>
            )}
            <ExternalLink url={url}>Ouvrir le lien renseigné</ExternalLink>
            {result.candidates
              .filter((candidate) => candidate !== url)
              .map((candidate, index) => (
                <div key={candidate}>
                  <ExternalLink
                    url={candidate}
                  >{`Correspondance possible ${index + 1}`}</ExternalLink>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        [kind === "website" ? "website" : "googleBusinessUrl"]: candidate,
                        [kind === "website" ? "websiteVerification" : "googleVerification"]:
                          verification(
                            "uncertain",
                            "Lien proposé sélectionné. Confirmez-le après consultation.",
                            "manual",
                            result.sources,
                            [candidate],
                          ),
                      })
                    }
                  >
                    Sélectionner
                  </Button>
                </div>
              ))}
            {url && result.status !== "confirmed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft({
                    ...draft,
                    [kind === "website" ? "websiteVerification" : "googleVerification"]:
                      verification(
                        "confirmed",
                        "Identité et lien confirmés manuellement.",
                        "manual",
                        [url],
                        [url],
                      ),
                    ...(kind === "website" ? { presence: "present" as const } : {}),
                  })
                }
              >
                Confirmer ce lien
              </Button>
            )}
            {result.sources.length > 0 && (
              <details className="text-[10px]">
                <summary>Sources consultées</summary>
                {result.sources.map((source, index) => (
                  <div key={`${index}-${source}`}>
                    <ExternalLink url={source}>{`Source ${index + 1}`}</ExternalLink>
                  </div>
                ))}
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}
