import { z } from "zod";
import type { Prospect } from "./schema";
import { verification } from "./verification";

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
  phone: z.string().max(80).default(""),
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
    phone: prospect.phone || candidate.phone,
    phoneSource: prospect.phone
      ? prospect.phoneSource
      : candidate.phone
        ? candidate.googleBusinessUrl
        : prospect.phoneSource,
    presence: manual && website ? "present" : prospect.presence,
    evidence: [prospect.evidence, observation].filter(Boolean).join("\n").slice(0, 3000),
    websiteVerification:
      candidate.website && (!prospect.website || prospect.website === candidate.website)
        ? verification(
            "confirmed",
            manual
              ? "Site sélectionné manuellement."
              : "Nom, ville et adresse concordent avec la fiche Google.",
            manual ? "manual" : "google",
            [candidate.googleBusinessUrl],
            [website],
          )
        : !prospect.website
          ? verification(
              "not-found",
              "Aucun site renseigné sur cette fiche Google. Une recherche sur le web reste nécessaire.",
              "google",
              [candidate.googleBusinessUrl],
            )
          : prospect.websiteVerification,
    googleVerification:
      !prospect.googleBusinessUrl || prospect.googleBusinessUrl === candidate.googleBusinessUrl
        ? verification(
            "confirmed",
            manual ? "Fiche sélectionnée manuellement." : "Nom, ville et adresse concordent.",
            manual ? "manual" : "google",
            [candidate.googleBusinessUrl],
            [candidate.googleBusinessUrl],
          )
        : prospect.googleVerification,
  };
}
