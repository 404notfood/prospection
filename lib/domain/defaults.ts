import type { Prospect, Workspace } from "./schema";
import { emptyVerification } from "./verification";
import { emptyCompanySize } from "./company-size";

export function emptyWorkspace(): Workspace {
  return {
    prospects: [],
    campaigns: [],
    events: [],
    offers: [
      {
        id: "landing",
        name: "Landing page",
        description:
          "Une page claire pour présenter une activité et faciliter la prise de contact.",
        price: "500 à 700 € · indicatif",
        conditions: "Base HT/TTC, contenus, hébergement et maintenance à préciser dans le devis.",
        enabled: true,
      },
      {
        id: "website",
        name: "Site vitrine",
        description: "Un site de quelques pages pour donner de la visibilité à une entreprise.",
        price: "Environ 1 000 € · indicatif",
        conditions: "Périmètre et prestations récurrentes à définir selon le projet.",
        enabled: true,
      },
      {
        id: "seo",
        name: "Référencement naturel",
        description: "Travailler la visibilité et la qualité de la présence en ligne.",
        price: "Sur devis",
        conditions:
          "Analyse préalable et objectifs à définir. Aucun résultat de classement garanti.",
        enabled: true,
      },
      {
        id: "automation",
        name: "Automatisation & applications",
        description: "Des outils adaptés pour simplifier les tâches quotidiennes.",
        price: "Sur devis",
        conditions: "Estimation après cadrage des besoins et des intégrations.",
        enabled: true,
      },
    ],
    templates: [
      {
        id: "intro",
        name: "Premier contact · présence web",
        subject: "La présence en ligne de {{entreprise}}",
        body: "Bonjour,\n\nJe suis {{nom}}, de {{societe}}. Je me permets de vous contacter au sujet de votre activité à {{ville}}.\n\n{{constat}}\n\nSi le sujet vous intéresse, je serais ravi d’échanger avec vous sur une présence en ligne adaptée à votre entreprise.\n\nSeriez-vous disponible pour un court échange ?\n\n{{signature}}\n\nSi vous ne souhaitez plus être contacté, vous pouvez simplement me l’indiquer en réponse à ce message.",
      },
    ],
    settings: {
      name: "Laurent Prado",
      company: "404NotFood",
      signature:
        "Laurent Prado\n404NotFood · Création web & solutions numériques\nhttps://404notfood.fr",
      batchSize: 10,
      concurrentTasks: 1,
      discoveryEnabled: false,
      webResearchEnabled: false,
      aiResearchEnabled: false,
      aiBatchSize: 3,
      followUpDays: 7,
      dailyAiCalls: 50,
    },
  };
}

export function blankProspect(): Prospect {
  return {
    id: crypto.randomUUID(),
    name: "",
    activity: "",
    city: "",
    address: "",
    siren: "",
    companySize: emptyCompanySize(),
    email: "",
    phone: "",
    website: "",
    seoAuditUrl: "",
    googleBusinessUrl: "",
    aiResearch: null,
    websiteVerification: emptyVerification(),
    googleVerification: emptyVerification(),
    qualification: "review",
    qualificationReason: "",
    emailDraft: null,
    repliedAt: "",
    automationRunId: "",
    discoveryRunId: "",
    emailSource: "",
    phoneSource: "",
    presence: "unknown",
    status: "review",
    campaignId: "",
    source: "Ajout manuel",
    sourceUrl: "",
    discoveredAt: new Date().toISOString(),
    verifiedAt: "",
    evidence: "",
    notes: "",
    followUpAt: "",
    opposed: false,
  };
}
