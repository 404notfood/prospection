import { z } from "zod";
import type { Campaign, Prospect } from "./schema";

export const companySizeSchema = z.object({
  category: z.enum(["PME", "ETI", "GE", "unknown"]).default("unknown"),
  employeeRange: z.string().max(4).default(""),
  categoryYear: z.string().max(4).default(""),
  employeeYear: z.string().max(4).default(""),
  checkedAt: z.string().default(""),
  siren: z.string().default(""),
  status: z.enum(["small", "large", "uncertain", "unchecked"]).default("unchecked"),
  reason: z.string().max(1000).default(""),
  sourceUrl: z.string().default(""),
});
export type CompanySize = z.infer<typeof companySizeSchema>;
export const emptyCompanySize = () => companySizeSchema.parse({});

export const employeeRanges: Record<string, string> = {
  NN: "Sans salarié déclaré",
  "00": "0 salarié",
  "01": "1–2 salariés",
  "02": "3–5 salariés",
  "03": "6–9 salariés",
  "11": "10–19 salariés",
  "12": "20–49 salariés",
  "21": "50–99 salariés",
  "22": "100–199 salariés",
  "31": "200–249 salariés",
  "32": "250–499 salariés",
  "41": "500–999 salariés",
  "42": "1 000–1 999 salariés",
  "51": "2 000–4 999 salariés",
  "52": "5 000–9 999 salariés",
  "53": "10 000 salariés ou plus",
};
const largeRanges = new Set(["21", "22", "31", "32", "41", "42", "51", "52", "53"]);
const smallRanges = new Set(["NN", "00", "01", "02", "03", "11"]);

export function classifyCompanySize(company: {
  siren: string;
  categorie_entreprise?: string | null;
  tranche_effectif_salarie?: string | null;
  annee_categorie_entreprise?: string | null;
  annee_tranche_effectif_salarie?: string | null;
}): CompanySize {
  const category = ["PME", "ETI", "GE"].includes(company.categorie_entreprise || "")
    ? (company.categorie_entreprise as "PME" | "ETI" | "GE")
    : "unknown";
  const employeeRange = Object.hasOwn(employeeRanges, company.tranche_effectif_salarie || "")
    ? company.tranche_effectif_salarie!
    : "";
  const large = category === "ETI" || category === "GE" || largeRanges.has(employeeRange);
  const small = category === "PME" && smallRanges.has(employeeRange) && !large;
  return {
    category,
    employeeRange,
    categoryYear: company.annee_categorie_entreprise || "",
    employeeYear: company.annee_tranche_effectif_salarie || "",
    siren: company.siren,
    checkedAt: new Date().toISOString(),
    sourceUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${company.siren}`,
    status: large ? "large" : small ? "small" : "uncertain",
    reason: large
      ? `Entreprise hors cible (30 salariés maximum) : ${category === "ETI" || category === "GE" ? `catégorie INSEE ${category}` : "tranche d’effectif de l’entreprise entièrement supérieure à 30 salariés"}.`
      : small
        ? "Catégorie INSEE PME et tranche d’effectif de l’entreprise sous le plafond de 30 salariés."
        : employeeRange === "12"
          ? "Tranche de 20 à 49 salariés : la source ne permet pas de confirmer le plafond de 30 salariés. Effectif exact à vérifier avant toute automatisation."
          : category === "PME"
            ? "Catégorie INSEE PME, mais effectif indisponible : le plafond de 30 salariés reste à vérifier."
            : "La catégorie TPE/PME et le plafond de 30 salariés de l’entreprise entière ne sont pas confirmés par la source. Taille à vérifier.",
  };
}

export function currentCompanySize(prospect: Prospect): CompanySize {
  const size = prospect.companySize;
  if (size.siren !== prospect.siren) return emptyCompanySize();
  if (
    size.status === "unchecked" ||
    (size.status === "uncertain" && size.category === "unknown" && !size.employeeRange)
  )
    return size;
  // Reapply the current ceiling to cached facts without changing their source date.
  const classified = classifyCompanySize({
    siren: size.siren,
    categorie_entreprise: size.category,
    tranche_effectif_salarie: size.employeeRange,
  });
  return { ...size, status: classified.status, reason: classified.reason };
}

export function applyCompanyTarget(prospect: Prospect, campaign: Campaign): Prospect {
  if (campaign.companyTarget !== "small") return prospect;
  const size = currentCompanySize(prospect);
  if (size.status !== "large")
    return {
      ...prospect,
      companySize: size,
      ...(size.status !== "small" && prospect.status === "ready"
        ? {
            status: "review" as const,
            qualification: "review" as const,
            qualificationReason: size.reason,
          }
        : {}),
    };
  return {
    ...prospect,
    companySize: size,
    qualification: "excluded",
    qualificationReason: size.reason,
    status: prospect.status === "ready" ? "review" : prospect.status,
    followUpAt: "",
  };
}
