import { z } from "zod";
import type { Prospect } from "./schema";

const url = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value));
export const webCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  website: z.union([z.literal(""), url]),
  googleBusinessUrl: url,
});
export type WebCandidate = z.infer<typeof webCandidateSchema>;

export function applyWebCandidate(
  prospect: Prospect,
  candidate: WebCandidate,
  manual = false,
): Prospect {
  const website = prospect.website || candidate.website;
  const observation = `Google Maps · ${new Date().toISOString().slice(0, 10)} : ${candidate.name}, ${candidate.address}. ${candidate.googleBusinessUrl}. ${manual ? "Correspondance sélectionnée." : "Correspondance automatique à confirmer."}`;
  return {
    ...prospect,
    website,
    googleBusinessUrl: prospect.googleBusinessUrl || candidate.googleBusinessUrl,
    presence: manual && website ? "present" : prospect.presence,
    evidence: [prospect.evidence, observation].filter(Boolean).join("\n").slice(0, 3000),
  };
}
