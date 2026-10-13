import { z } from "zod";
import { setTimeout as delay } from "node:timers/promises";
import { classifyCompanySize, emptyCompanySize, type CompanySize } from "@/lib/domain/company-size";

export const companySizeFields = {
  categorie_entreprise: z.string().nullable().optional(),
  tranche_effectif_salarie: z.string().nullable().optional(),
  annee_categorie_entreprise: z.string().nullable().optional(),
  annee_tranche_effectif_salarie: z.string().nullable().optional(),
};

let nextRequestAt = 0;
async function paceLookup() {
  const wait = Math.max(0, nextRequestAt - Date.now());
  nextRequestAt = Date.now() + wait + 350;
  if (wait) await delay(wait);
}

export async function lookupCompanySize(siren: string): Promise<CompanySize> {
  const unresolved = (reason: string) => ({
    ...emptyCompanySize(),
    siren,
    checkedAt: new Date().toISOString(),
    status: "uncertain" as const,
    reason,
  });
  if (!/^\d{9}$/.test(siren))
    return unresolved(
      "SIREN nécessaire pour vérifier la taille de l’entreprise auprès de la source publique.",
    );
  try {
    await paceLookup();
    const response = await fetch(
      `https://recherche-entreprises.api.gouv.fr/search?${new URLSearchParams({ q: siren, per_page: "1", minimal: "true" })}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      return unresolved(
        "La source publique ne permet pas de vérifier la taille pour le moment. Réessayez plus tard.",
      );
    const result = z
      .object({ results: z.array(z.object({ siren: z.string(), ...companySizeFields })) })
      .parse(await response.json());
    const company = result.results.find((item) => item.siren === siren);
    return company
      ? classifyCompanySize(company)
      : unresolved(
          "Aucune entreprise correspondant exactement au SIREN n’a été retournée. Taille à vérifier.",
        );
  } catch {
    return unresolved(
      "Vérification de taille interrompue ou source indisponible. Réessayez plus tard.",
    );
  }
}
