import { z } from "zod";
import { aiResearchSchema } from "./ai-research";
import { verificationSchema, emptyVerification } from "./verification";
import { automationConfigSchema, defaultAutomation, draftSchema } from "./automation";
import { companySizeSchema, emptyCompanySize } from "./company-size";

export const statusSchema = z.enum([
  "review",
  "ready",
  "contacted",
  "follow-up",
  "meeting",
  "proposal",
  "won",
  "declined",
]);
export const presenceSchema = z.enum(["unknown", "absent", "present"]);
const shortText = z.string().trim().max(240);
const optionalEmail = z.union([z.literal(""), z.email()]);
const optionalUrl = z.union([
  z.literal(""),
  z.url().refine((url) => /^https?:\/\//i.test(url), "Utilisez une URL http ou https."),
]);
const date = z.union([z.literal(""), z.iso.date()]);

export const prospectSchema = z.object({
  id: z.string().min(1),
  name: shortText.min(1),
  activity: shortText.min(1),
  city: shortText.min(1),
  address: shortText,
  siren: z.union([z.literal(""), z.string().regex(/^\d{9}$/)]),
  companySize: companySizeSchema.default(emptyCompanySize),
  email: optionalEmail,
  phone: shortText,
  website: optionalUrl,
  seoAuditUrl: optionalUrl.default(""),
  googleBusinessUrl: optionalUrl.default(""),
  aiResearch: aiResearchSchema.nullable().default(null),
  websiteVerification: verificationSchema.default(emptyVerification),
  googleVerification: verificationSchema.default(emptyVerification),
  qualification: z.enum(["review", "matched", "excluded"]).default("review"),
  qualificationReason: z.string().max(1000).default(""),
  emailDraft: draftSchema.default(null),
  repliedAt: z.string().default(""),
  automationRunId: z.string().default(""),
  discoveryRunId: z.string().default(""),
  emailSource: z.string().default(""),
  phoneSource: z.string().default(""),
  presence: presenceSchema,
  status: statusSchema,
  campaignId: z.string(),
  source: shortText,
  sourceUrl: optionalUrl,
  discoveredAt: z.iso.datetime(),
  verifiedAt: date,
  evidence: z.string().max(3000),
  notes: z.string().max(10000),
  followUpAt: date,
  opposed: z.boolean(),
});

export const campaignSchema = z.preprocess(
  (input) => {
    if (input && typeof input === "object" && !("companyTarget" in input)) {
      // The new size policy changes source ordering: restart discovery without deleting prospects.
      return {
        ...input,
        companyTarget: "small",
        searchPage: 1,
        searchOffset: 0,
        searchExhausted: false,
      };
    }
    return input;
  },
  z.object({
    id: z.string().min(1),
    name: shortText.min(1),
    city: shortText.min(1),
    radius: z.number().int().min(1).max(50),
    companyTarget: z.enum(["small", "all"]).default("small"),
    searchScope: z.enum(["all", "targeted"]).default("targeted"),
    activities: z.array(shortText.min(1)).max(10).default([]),
    nafCodes: z
      .string()
      .max(200)
      .refine(
        (value) => value === "" || /^\d{2}\.\d{2}[A-Z](,\d{2}\.\d{2}[A-Z])*$/.test(value),
        "Codes NAF attendus : 43.34Z,43.32A",
      )
      .default(""),
    criteria: z.string().max(3000),
    offerId: z.string(),
    templateId: z.string(),
    batchSize: z.number().int().min(1).max(25),
    state: z.enum(["active", "paused", "completed"]),
    createdAt: z.iso.datetime(),
    searchPage: z.number().int().min(1),
    searchOffset: z.number().int().min(0).max(25).default(0),
    searchExhausted: z.boolean(),
    automation: automationConfigSchema.default(defaultAutomation),
  }),
);

export const offerSchema = z.object({
  id: z.string().min(1),
  name: shortText.min(1),
  description: z.string().max(3000),
  price: shortText,
  conditions: z.string().max(3000),
  enabled: z.boolean(),
});

export const templateSchema = z.object({
  id: z.string().min(1),
  name: shortText.min(1),
  subject: shortText.min(1),
  body: z.string().min(1).max(10000),
});

export const eventSchema = z.object({
  id: z.string().min(1),
  prospectId: z.string(),
  campaignId: z.string(),
  kind: z.enum([
    "note",
    "email",
    "call",
    "status",
    "discovery",
    "campaign",
    "response",
    "automation",
  ]),
  title: shortText.min(1),
  detail: z.string().max(3000),
  createdAt: z.iso.datetime(),
});

export const settingsSchema = z.object({
  name: shortText.min(1),
  company: shortText.min(1),
  signature: z.string().max(3000),
  batchSize: z.number().int().min(1).max(25),
  concurrentTasks: z.number().int().min(1).max(3),
  discoveryEnabled: z.boolean(),
  webResearchEnabled: z.boolean().default(false),
  aiResearchEnabled: z.boolean().default(false),
  aiBatchSize: z.number().int().min(1).max(5).default(3),
  followUpDays: z.number().int().min(1).max(90).default(7),
  dailyAiCalls: z.number().int().min(1).max(1000).default(50),
});

export const workspaceSchema = z.object({
  prospects: z.array(prospectSchema).max(10000),
  campaigns: z.array(campaignSchema).max(200),
  offers: z.array(offerSchema).max(100),
  templates: z.array(templateSchema).max(100),
  events: z.array(eventSchema).max(20000),
  settings: settingsSchema,
});

export type Prospect = z.infer<typeof prospectSchema>;
export type ProspectStatus = Prospect["status"];
export type Campaign = z.infer<typeof campaignSchema>;
export type Offer = z.infer<typeof offerSchema>;
export type EmailTemplate = z.infer<typeof templateSchema>;
export type TimelineEvent = z.infer<typeof eventSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Workspace = z.infer<typeof workspaceSchema>;

export interface WorkspaceSnapshot {
  data: Workspace;
  revision: number;
}
