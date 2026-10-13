import type { Prospect } from "./schema";
import { statusLabels, presenceLabels } from "./prospects";
import { displayVerification, verificationLabels } from "./verification";

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string) {
  // Neutralize spreadsheet formulas when the CSV is opened in Excel.
  const safe = /^[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function exportProspects(prospects: Prospect[]) {
  const header = [
    "Entreprise",
    "Activité",
    "Ville",
    "SIREN",
    "Email",
    "Téléphone",
    "Site",
    "Audit SEO",
    "Fiche Google",
    "Analyse IA",
    "Sources IA",
    "Présence numérique",
    "Statut",
    "Source",
    "Lien source",
    "Vérifié le",
    "Constats",
    "Notes",
    "Relance",
    "Opposition",
    "Vérification site",
    "Vérification Google",
    "Qualification",
    "Objet du brouillon",
    "Brouillon",
  ];
  const rows = prospects.map((p) => [
    p.name,
    p.activity,
    p.city,
    p.siren,
    p.email,
    p.phone,
    p.website,
    p.seoAuditUrl,
    p.googleBusinessUrl,
    p.aiResearch?.summary || "",
    p.aiResearch?.sources.map((source) => source.url).join("\n") || "",
    presenceLabels[p.presence],
    statusLabels[p.status],
    p.source,
    p.sourceUrl,
    p.verifiedAt,
    p.evidence,
    p.notes,
    p.followUpAt,
    p.opposed ? "Oui" : "Non",
    verificationLabels[displayVerification(p, "website").status],
    verificationLabels[displayVerification(p, "google").status],
    p.qualificationReason,
    p.emailDraft?.subject || "",
    p.emailDraft?.body || "",
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
