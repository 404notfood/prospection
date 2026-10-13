import type { Campaign, Workspace } from "./schema";
import { defaultAutomation } from "./automation";

export function newCampaign(data: Workspace): Campaign {
  return {
    id: crypto.randomUUID(),
    name: "",
    city: "",
    radius: 20,
    companyTarget: "small",
    searchScope: "all",
    activities: [],
    nafCodes: "",
    criteria: "Aucun site identifié",
    offerId: data.offers[0]?.id || "",
    templateId: data.templates[0]?.id || "",
    batchSize: data.settings.batchSize,
    state: "active",
    createdAt: new Date().toISOString(),
    searchPage: 1,
    searchOffset: 0,
    searchExhausted: false,
    automation: defaultAutomation(),
  };
}

export function prepareCampaign(draft: Campaign): Campaign {
  return {
    ...draft,
    name: draft.name.trim() || `Prospection autour de ${draft.city.trim()}`.slice(0, 240),
    ...(draft.searchScope === "all" ? { activities: [], nafCodes: "" } : {}),
  };
}

export function campaignSearchLabel(campaign: Campaign) {
  return campaign.searchScope === "all" || (!campaign.activities.length && !campaign.nafCodes)
    ? "Tous les métiers · recherche large"
    : campaign.activities.join(", ") || `Codes NAF : ${campaign.nafCodes}`;
}
