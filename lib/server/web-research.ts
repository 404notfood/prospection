import { z } from "zod";
import { webUrl } from "@/lib/domain/urls";
import { applyWebCandidate, type WebCandidate } from "@/lib/domain/web-research";
import type { Prospect } from "@/lib/domain/schema";
import { verification } from "@/lib/domain/verification";

const placeSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }),
  formattedAddress: z.string().default(""),
  websiteUri: z.string().optional(),
  googleMapsUri: z.string(),
  businessStatus: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
});
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function googleResearchConfigured() {
  return !!process.env.GOOGLE_PLACES_API_KEY?.trim();
}

export async function researchBusiness(
  prospect: Pick<Prospect, "name" | "city" | "address">,
  signal?: AbortSignal,
) {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key)
    throw new Error(
      "Google Places n’est pas configuré. Ajoutez la clé sur le serveur ; les recherches manuelles restent disponibles.",
    );
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.websiteUri,places.googleMapsUri,places.businessStatus,places.internationalPhoneNumber",
    },
    body: JSON.stringify({
      textQuery: [prospect.name, prospect.address, prospect.city].filter(Boolean).join(" "),
      languageCode: "fr",
      regionCode: "FR",
      pageSize: 5,
    }),
    cache: "no-store",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
      : AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Le quota Google Places est atteint. Réessayez plus tard."
        : "Google Places est indisponible. Vérifiez la clé, l’activation de Places API (New) et la facturation.",
    );
  const result = z
    .object({ places: z.array(placeSchema).default([]) })
    .parse(await response.json());
  const candidates: WebCandidate[] = result.places
    .filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY" && webUrl(place.googleMapsUri))
    .map((place) => ({
      id: place.id,
      name: place.displayName.text,
      address: place.formattedAddress,
      website: webUrl(place.websiteUri || "") || "",
      googleBusinessUrl: webUrl(place.googleMapsUri)!,
      phone: place.internationalPhoneNumber || "",
    }));
  // Name, municipality AND street must agree; ambiguous results remain manual.
  const exact = candidates.filter((candidate) => {
    const address = ` ${normalize(candidate.address)} `;
    const street = normalize(prospect.address);
    return (
      normalize(candidate.name) === normalize(prospect.name) &&
      address.includes(` ${normalize(prospect.city)} `) &&
      street.length > 5 &&
      address.includes(` ${street} `)
    );
  });
  return { candidates, match: exact.length === 1 ? exact[0] : null };
}

export async function enrichProspects(prospects: Prospect[]) {
  let failed = 0;
  let ambiguous = 0;
  const enriched: Prospect[] = [];
  const deadline = AbortSignal.timeout(20000);
  // Three simultaneous requests at most, with each request bounded by a timeout.
  for (let index = 0; index < prospects.length; index += 3) {
    if (deadline.aborted) {
      failed += prospects.length - index;
      enriched.push(...prospects.slice(index));
      break;
    }
    const failuresBeforeBatch = failed;
    const batch = await Promise.all(
      prospects.slice(index, index + 3).map(async (prospect) => {
        try {
          const { match, candidates } = await researchBusiness(prospect, deadline);
          if (!match) {
            ambiguous++;
            return {
              ...prospect,
              websiteVerification:
                prospect.websiteVerification.status === "confirmed"
                  ? prospect.websiteVerification
                  : verification(
                      candidates.some((c) => c.website) || prospect.website
                        ? "uncertain"
                        : "not-found",
                      "Aucune correspondance certaine dans Google Places. Cela ne prouve pas une absence sur le web.",
                      "google",
                      candidates.map((c) => c.googleBusinessUrl),
                      candidates.map((c) => c.website).filter(Boolean),
                    ),
              googleVerification:
                prospect.googleVerification.status === "confirmed"
                  ? prospect.googleVerification
                  : verification(
                      candidates.length || prospect.googleBusinessUrl ? "uncertain" : "not-found",
                      "Aucune fiche ne concorde certainement avec l’identité recherchée.",
                      "google",
                      candidates.map((c) => c.googleBusinessUrl),
                      candidates.map((c) => c.googleBusinessUrl),
                    ),
            };
          }
          return applyWebCandidate(prospect, match);
        } catch {
          failed++;
          return {
            ...prospect,
            websiteVerification:
              prospect.websiteVerification.status === "confirmed"
                ? prospect.websiteVerification
                : verification(
                    "error",
                    "Google Places indisponible. Relancez la recherche.",
                    "google",
                  ),
            googleVerification:
              prospect.googleVerification.status === "confirmed"
                ? prospect.googleVerification
                : verification(
                    "error",
                    "Google Places indisponible. Relancez la recherche.",
                    "google",
                  ),
          };
        }
      }),
    );
    enriched.push(...batch);
    // Stop an unavailable provider instead of repeating failures across the whole lot.
    if (failed - failuresBeforeBatch === batch.length) {
      failed += prospects.length - enriched.length;
      enriched.push(...prospects.slice(enriched.length));
      break;
    }
  }
  const warnings: string[] = [];
  if (failed)
    warnings.push(
      `Google Places indisponible pour ${failed} entreprise(s). Les entreprises sont conservées ; relancez la recherche depuis leur fiche.`,
    );
  if (ambiguous)
    warnings.push(
      `${ambiguous} entreprise(s) sans correspondance Google certaine : utilisez « Chercher le site et la fiche Google » dans leur fiche.`,
    );
  return { prospects: enriched, warnings };
}
