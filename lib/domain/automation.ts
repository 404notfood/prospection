import { z } from "zod";
import type { Campaign, Prospect, Workspace } from "./schema";
import { displayVerification } from "./verification";
import { canContact, qualificationError } from "./prospects";
import { renderMessage } from "./messages";

export const automationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intervalHours: z.number().int().min(1).max(168).default(24),
  maxPages: z.number().int().min(1).max(10).default(3),
  maxProspects: z.number().int().min(1).max(100).default(25),
  maxAiCalls: z.number().int().min(1).max(200).default(20),
  qualify: z.boolean().default(true),
  prepareMessages: z.boolean().default(true),
  nextRunAt: z.string().default(""),
});
export function defaultAutomation() { return automationConfigSchema.parse({}); }
export const draftSchema = z.object({
  subject: z.string().max(240), body: z.string().max(10000),
  createdAt: z.iso.datetime(), method: z.enum(["template", "ai", "manual"]),
}).nullable();
export function campaignTarget(campaign: Campaign) {
  return JSON.stringify([campaign.city, campaign.radius, campaign.activities, campaign.nafCodes, campaign.criteria, campaign.offerId, campaign.templateId]);
}
export function qualifyAutomatically(prospect: Prospect, campaign: Campaign): Prospect {
  if (prospect.status !== "review" || prospect.opposed) return prospect;
  const check = displayVerification(prospect, "website");
  if (check.status === "confirmed" && prospect.website) {
    if (campaign.criteria === "Aucun site identifié") return { ...prospect, qualification: "excluded", qualificationReason: "Site confirmé : hors du critère « Aucun site identifié »." };
    if (campaign.criteria === "Présence numérique à améliorer") return { ...prospect, qualification: "review", qualificationReason: "Site trouvé. Le besoin d’amélioration nécessite votre appréciation." };
  }
  // Only a dated, sourced search can support the observation "no site identified".
  const presence = check.status === "confirmed" && prospect.website ? "present"
    : check.status === "not-found" && check.method !== "google" && check.sources.length >= 2 ? "absent" : "unknown";
  if (presence === "unknown" || campaign.criteria === "Qualification manuelle selon les notes") return { ...prospect, qualification: "review", qualificationReason: "La vérification ne permet pas une qualification certaine." };
  const next: Prospect = {
    ...prospect, presence, status: "ready", qualification: "matched", qualificationReason: check.reason,
    verifiedAt: check.checkedAt.slice(0, 10),
    evidence: [prospect.evidence, `${check.reason}\nSources : ${check.sources.join(" · ")}`].filter(Boolean).join("\n").slice(0, 3000),
  };
  return qualificationError(next, campaign) ? prospect : next;
}
export function prepareDraft(prospect: Prospect, data: Workspace): Prospect {
  if (prospect.emailDraft || !canContact(prospect)) return prospect;
  const campaign = data.campaigns.find((c) => c.id === prospect.campaignId);
  const template = data.templates.find((t) => t.id === campaign?.templateId) || data.templates[0];
  if (!template) return prospect;
  return { ...prospect, emailDraft: { ...renderMessage(template, prospect, data.settings), createdAt: new Date().toISOString(), method: "template" } };
}
export function followUpDate(days: number, from = new Date()) {
  const date = new Date(from.getTime() + days * 86400000);
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}
export function updateDueFollowUps(data: Workspace, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  for (const prospect of data.prospects) {
    if (prospect.opposed || prospect.repliedAt || !["contacted", "follow-up"].includes(prospect.status) || !prospect.followUpAt || prospect.followUpAt > today) continue;
    const id = `followup-${prospect.id}-${prospect.followUpAt}`;
    if (data.events.some((event) => event.id === id)) continue;
    prospect.status = "follow-up";
    data.events.unshift({ id, prospectId: prospect.id, campaignId: prospect.campaignId, kind: "status", title: "Relance à préparer", detail: `${prospect.name} · échéance du ${prospect.followUpAt}. Envoi manuel.`, createdAt: now.toISOString() });
  }
  return data;
}
