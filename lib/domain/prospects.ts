import type { Campaign, Prospect, ProspectStatus, Workspace } from "./schema";

export const statusLabels: Record<ProspectStatus, string> = {
  review: "À examiner",
  ready: "À contacter",
  contacted: "Contacté",
  "follow-up": "À relancer",
  meeting: "Rendez-vous",
  proposal: "Devis envoyé",
  won: "Gagné",
  declined: "Refusé",
};
export const presenceLabels = {
  unknown: "À vérifier",
  absent: "Aucun site identifié",
  present: "Site identifié",
};
export const statusColors: Record<ProspectStatus, string> = {
  review: "bg-amber-50 text-amber-700 border-amber-200/60",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  contacted: "bg-blue-50 text-blue-700 border-blue-200/60",
  "follow-up": "bg-orange-50 text-orange-700 border-orange-200/60",
  meeting: "bg-violet-50 text-violet-700 border-violet-200/60",
  proposal: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
  won: "bg-emerald-100 text-emerald-800 border-emerald-200/60",
  declined: "bg-stone-100 text-stone-600 border-stone-200/60",
};

export function campaignProspects(data: Workspace, id: string) {
  return data.prospects.filter((prospect) => prospect.campaignId === id);
}

export function counts(prospects: Prospect[]) {
  return {
    found: prospects.length,
    review: prospects.filter((p) => p.status === "review" && !p.opposed).length,
    qualified: prospects.filter(
      (p) => p.status !== "review" && p.status !== "declined" && !p.opposed,
    ).length,
    ready: prospects.filter((p) => p.status === "ready" && !p.opposed).length,
    won: prospects.filter((p) => p.status === "won").length,
  };
}

export function deduplicate(existing: Prospect[], incoming: Prospect[]) {
  const sirens = new Set(existing.filter((p) => p.siren).map((p) => p.siren));
  const names = new Set(existing.map(identity));
  const unidentified = new Set(existing.filter((p) => !p.siren).map(identity));
  return incoming.filter((prospect) => {
    const key = identity(prospect);
    if (prospect.siren ? sirens.has(prospect.siren) || unidentified.has(key) : names.has(key))
      return false;
    if (prospect.siren) sirens.add(prospect.siren);
    else unidentified.add(key);
    names.add(key);
    return true;
  });
}

function identity(prospect: Prospect) {
  return `${prospect.name}|${prospect.city}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, "");
}

export function canContact(prospect: Prospect) {
  return !prospect.opposed && !["declined", "won", "review"].includes(prospect.status);
}

export function qualificationError(prospect: Prospect, campaign?: Campaign) {
  if (prospect.presence === "absent" && prospect.website)
    return "Un site est renseigné : choisissez « Site identifié » ou corrigez l’URL.";
  if (prospect.opposed && !["declined", "review"].includes(prospect.status))
    return "Ce prospect s’est opposé à la prospection. Sélectionnez Refusé.";
  if (prospect.status !== "review" && prospect.status !== "declined") {
    if (!prospect.verifiedAt || !prospect.evidence.trim())
      return "Ajoutez une date de vérification et les faits observés avant de qualifier ce prospect.";
    if (prospect.presence === "unknown")
      return "Vérifiez la présence numérique avant de qualifier ce prospect.";
    if (campaign?.criteria === "Aucun site identifié" && prospect.presence === "present")
      return "Un site a été identifié : ce prospect ne répond pas au critère de sa campagne.";
  }
  return null;
}

export function validateWorkspace(data: Workspace) {
  for (const list of [data.prospects, data.campaigns, data.offers, data.templates, data.events]) {
    if (new Set(list.map((item) => item.id)).size !== list.length) return "Identifiants dupliqués.";
  }
  const campaigns = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]));
  if (deduplicate([], data.prospects).length !== data.prospects.length)
    return "Des entreprises en doublon sont présentes dans le carnet.";
  const offerIds = new Set(data.offers.map((offer) => offer.id));
  const templateIds = new Set(data.templates.map((template) => template.id));
  for (const campaign of data.campaigns) {
    if (campaign.offerId && !offerIds.has(campaign.offerId)) return "Prestation introuvable.";
    if (campaign.templateId && !templateIds.has(campaign.templateId))
      return "Modèle de message introuvable.";
  }
  for (const prospect of data.prospects) {
    if (prospect.campaignId && !campaigns.has(prospect.campaignId)) return "Campagne introuvable.";
    const error = qualificationError(prospect, campaigns.get(prospect.campaignId));
    if (error) return error;
  }
  return null;
}
