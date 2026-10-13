import { z } from "zod";
import { blankProspect } from "@/lib/domain/defaults";
import type { Campaign, Prospect } from "@/lib/domain/schema";
import { activityFilter } from "@/lib/domain/activities";

const establishment = z.object({
  adresse: z.string().nullable(),
  libelle_commune: z.string().nullable(),
  etat_administratif: z.string(),
  activite_principale: z.string().nullable(),
});
const responseSchema = z.object({
  results: z.array(
    z.object({
      siren: z.string(),
      nom_complet: z.string(),
      etat_administratif: z.string(),
      activite_principale: z.string().nullable(),
      matching_etablissements: z.array(establishment).optional(),
      siege: establishment,
    }),
  ),
  total_pages: z.number(),
  total_results: z.number(),
});
const communeSchema = z.array(
  z.object({
    nom: z.string(),
    centre: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    codesPostaux: z.array(z.string()),
  }),
);

async function fetchJson(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "La source limite les appels. Réessayez dans quelques instants."
        : "La source publique est temporairement indisponible.",
    );
  return response.json();
}

export async function discover(campaign: Campaign, capacity = campaign.batchSize) {
  const filter = activityFilter(campaign);
  const cityQuery = new URLSearchParams({
    nom: campaign.city,
    fields: "nom,centre,codesPostaux",
    boost: "population",
    limit: "8",
  });
  const communes = communeSchema.parse(
    await fetchJson(`https://geo.api.gouv.fr/communes?${cityQuery}`),
  );
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const matches = communes.filter((city) => normalize(city.nom) === normalize(campaign.city));
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? "Plusieurs communes portent ce nom. Précisez une autre zone de départ."
        : "Ville introuvable. Saisissez le nom complet de la commune.",
    );
  const [longitude, latitude] = matches[0].centre.coordinates;
  const params = new URLSearchParams({
    lat: String(latitude),
    long: String(longitude),
    radius: String(campaign.radius),
    etat_administratif: "A",
    page: String(campaign.searchPage),
    per_page: String(campaign.batchSize),
  });
  if (filter.codes) params.set("activite_principale", filter.codes);
  const url = `https://recherche-entreprises.api.gouv.fr/near_point?${params}`;
  const result = responseSchema.parse(await fetchJson(url));
  const codes = new Set(filter.codes.split(",").filter(Boolean));
  const prospects: Prospect[] = [];
  let offset = campaign.searchOffset;
  for (; offset < result.results.length; offset++) {
    if (prospects.length >= capacity) break;
    const company = result.results[offset];
    if (company.etat_administratif !== "A") continue;
    // Only retain an open matching establishment in the geographic response.
    const local = company.matching_etablissements?.find(
      (e) =>
        e.etat_administratif === "A" && (!codes.size || codes.has(e.activite_principale || "")),
    );
    if (!local) continue;
    prospects.push({
      ...blankProspect(),
      name: company.nom_complet,
      siren: company.siren,
      address: local.adresse || "",
      city: local.libelle_commune || campaign.city,
      activity: `${local.activite_principale || company.activite_principale || "Activité à vérifier"}`,
      campaignId: campaign.id,
      source: "API Recherche d’entreprises · données publiques",
      sourceUrl: `https://annuaire-entreprises.data.gouv.fr/entreprise/${company.siren}`,
    });
  }
  const pageComplete = offset >= result.results.length;
  return {
    prospects,
    nextPage: campaign.searchPage + (pageComplete ? 1 : 0),
    nextOffset: pageComplete ? 0 : offset,
    exhausted: pageComplete && campaign.searchPage >= result.total_pages,
    sourceTotal: result.total_results,
    warnings:
      !filter.codes && campaign.searchScope !== "all" && campaign.activities.length > 0
        ? [
            "Recherche géographique toutes activités : les métiers saisis ne correspondent pas au catalogue automatique. Vérifiez l’activité de chaque entreprise ou précisez des codes NAF.",
          ]
        : [],
  };
}
