import { z } from "zod";
import type { Prospect } from "./schema";
import { verification } from "./verification";

const url = z.url().refine((value) => /^https?:\/\//i.test(value));
const optionalUrl = z.union([z.literal(""), url]);
export const researchIdentitySchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(240),
  city: z.string().trim().min(1).max(240),
  address: z.string().trim().max(240),
  activity: z.string().trim().max(240),
  siren: z.union([z.literal(""), z.string().regex(/^\d{9}$/)]),
  website: optionalUrl,
});
export type ResearchIdentity = z.infer<typeof researchIdentitySchema>;
export function researchIdentity(prospect: Prospect): ResearchIdentity {
  return researchIdentitySchema.parse(prospect);
}
export function researchIdentityKey(prospect: ResearchIdentity) {
  return JSON.stringify([
    prospect.id,
    prospect.name,
    prospect.city,
    prospect.address,
    prospect.activity,
    prospect.siren,
  ]);
}
export const aiResearchSchema = z.object({
  identityKey: z.string().max(3000),
  summary: z.string().max(2000),
  website: optionalUrl,
  googleBusinessUrl: optionalUrl,
  sources: z.array(z.object({ url, title: z.string().max(240) })).max(12),
  researchedAt: z.iso.datetime(),
  identityConfirmed: z.boolean().default(false),
  websiteStatus: z.enum(["confirmed", "uncertain", "not-found", "unknown"]).default("unknown"),
  googleStatus: z.enum(["confirmed", "uncertain", "not-found", "unknown"]).default("unknown"),
});
export type AiResearch = z.infer<typeof aiResearchSchema>;

export function applyAiResearch(prospect: Prospect, research: AiResearch): Prospect {
  const website = prospect.website || research.website;
  return {
    ...prospect,
    website,
    googleBusinessUrl: prospect.googleBusinessUrl || research.googleBusinessUrl,
    presence: website ? "present" : prospect.presence,
    aiResearch: {
      ...research,
      identityKey: researchIdentityKey(researchIdentity({ ...prospect, website })),
    },
    websiteVerification: research.website ? verification("confirmed", "Site sélectionné après consultation des sources.", "manual", research.sources.map((s) => s.url), [research.website]) : prospect.websiteVerification,
    googleVerification: research.googleBusinessUrl ? verification("confirmed", "Fiche Google sélectionnée après consultation des sources.", "manual", research.sources.map((s) => s.url), [research.googleBusinessUrl]) : prospect.googleVerification,
  };
}

export function applyAiVerification(prospect: Prospect, research: AiResearch): Prospect {
  const sources = research.sources.map((s) => s.url);
  const assess = (kind: "website" | "google") => {
    const previous = kind === "website" ? prospect.websiteVerification : prospect.googleVerification;
    const currentUrl = kind === "website" ? prospect.website : prospect.googleBusinessUrl;
    const candidate = kind === "website" ? research.website : research.googleBusinessUrl;
    const reported = kind === "website" ? research.websiteStatus : research.googleStatus;
    if (previous.status === "confirmed") return previous;
    if (currentUrl && candidate !== currentUrl) return verification("uncertain", "Un lien est déjà renseigné ; la nouvelle recherche ne permet pas de le confirmer.", "ai", sources, [currentUrl, candidate].filter(Boolean));
    const independent = new Set(sources.map((s) => new URL(s).hostname)).size >= 2;
    const status = research.identityConfirmed && candidate && reported === "confirmed" ? "confirmed"
      : research.identityConfirmed && !candidate && !currentUrl && reported === "not-found" && independent ? "not-found"
      : candidate || currentUrl || reported === "uncertain" ? "uncertain" : "unsearched";
    return verification(status, status === "not-found" ? "Aucun résultat identifié dans les sources consultées à cette date." : research.summary.slice(0, 1000), "ai", sources, candidate ? [candidate] : []);
  };
  const websiteVerification = assess("website");
  const googleVerification = assess("google");
  return { ...prospect, aiResearch: research, websiteVerification, googleVerification,
    website: prospect.website || (websiteVerification.status === "confirmed" ? research.website : ""),
    googleBusinessUrl: prospect.googleBusinessUrl || (googleVerification.status === "confirmed" ? research.googleBusinessUrl : "") };
}
