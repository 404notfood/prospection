import { z } from "zod";
import type { Prospect } from "./schema";

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
  };
}
