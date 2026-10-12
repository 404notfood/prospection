import type { Prospect } from "./schema";
import { statusLabels, presenceLabels } from "./prospects";

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
    "Présence numérique",
    "Statut",
    "Source",
    "Lien source",
    "Vérifié le",
    "Constats",
    "Notes",
    "Relance",
    "Opposition",
  ];
  const rows = prospects.map((p) => [
    p.name,
    p.activity,
    p.city,
    p.siren,
    p.email,
    p.phone,
    p.website,
    presenceLabels[p.presence],
    statusLabels[p.status],
    p.source,
    p.sourceUrl,
    p.verifiedAt,
    p.evidence,
    p.notes,
    p.followUpAt,
    p.opposed ? "Oui" : "Non",
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
}
