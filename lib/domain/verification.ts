import { z } from "zod";
import type { Prospect } from "./schema";

const url = z.url().refine((value) => /^https?:\/\//i.test(value));
export const verificationSchema = z.object({
  status: z.enum(["unsearched", "confirmed", "uncertain", "not-found", "error"]),
  checkedAt: z.union([z.literal(""), z.iso.datetime()]),
  reason: z.string().max(1000),
  method: z.enum(["", "manual", "google", "ai"]),
  sources: z.array(url).max(12),
  candidates: z.array(url).max(10),
});
export type Verification = z.infer<typeof verificationSchema>;
export const verificationLabels: Record<Verification["status"], string> = {
  unsearched: "Non recherché",
  confirmed: "Trouvé et confirmé",
  uncertain: "Possible · à vérifier",
  "not-found": "Non identifié après recherche",
  error: "Recherche en erreur",
};
export function emptyVerification(): Verification {
  return {
    status: "unsearched",
    checkedAt: "",
    reason: "",
    method: "",
    sources: [],
    candidates: [],
  };
}
export function verification(
  status: Verification["status"],
  reason: string,
  method: Verification["method"],
  sources: string[] = [],
  candidates: string[] = [],
): Verification {
  return {
    status,
    reason,
    method,
    sources: [...new Set(sources)].slice(0, 12),
    candidates: [...new Set(candidates)].slice(0, 10),
    checkedAt: new Date().toISOString(),
  };
}
export function displayVerification(prospect: Prospect, kind: "website" | "google") {
  const stored = kind === "website" ? prospect.websiteVerification : prospect.googleVerification;
  const value = kind === "website" ? prospect.website : prospect.googleBusinessUrl;
  if (
    stored.status === "unsearched" &&
    kind === "website" &&
    prospect.verifiedAt &&
    prospect.evidence &&
    prospect.presence !== "unknown"
  )
    return {
      ...stored,
      status:
        prospect.presence === "present" && value ? ("confirmed" as const) : ("not-found" as const),
      method: "manual" as const,
      reason:
        `Vérification manuelle enregistrée le ${prospect.verifiedAt}. ${prospect.evidence}`.slice(
          0,
          1000,
        ),
      sources: prospect.sourceUrl ? [prospect.sourceUrl] : [],
    };
  if (stored.status !== "unsearched" || !value) return stored;
  return {
    ...stored,
    status: "uncertain" as const,
    reason: "Lien renseigné, confirmation à effectuer.",
    candidates: [value],
  };
}
