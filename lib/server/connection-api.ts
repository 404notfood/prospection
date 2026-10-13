import { z } from "zod";
import { sameOrigin } from "./session";
import { startResearch, finishResearch } from "./research-lock";
import { googleApiError, googleTransportError } from "./google-api-error";
import {
  apiCredentials,
  connectionConfiguration,
  saveApiCredentials,
  deleteApiCredentials,
  type ApiProvider,
} from "./api-credentials";

const providerSchema = z.enum(["openai", "google"]);
const saveSchema = z.object({
  provider: providerSchema,
  apiKey: z
    .string()
    .trim()
    .min(16)
    .max(2048)
    .regex(/^[\x21-\x7e]+$/)
    .optional(),
  model: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-zA-Z0-9._:-]+$/)
    .optional(),
});
const respond = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

async function verifyConnection(provider: ApiProvider, ownerId: string) {
  const { key, model } = await apiCredentials(provider, ownerId);
  if (!key) return respond({ error: "Enregistrez une clé avant de la vérifier." }, 422);
  let response: Response;
  try {
    response = await fetch(
      provider === "openai"
        ? `https://api.openai.com/v1/models/${encodeURIComponent(model)}`
        : "https://places.googleapis.com/v1/places:searchText",
      {
        method: provider === "openai" ? "GET" : "POST",
        headers:
          provider === "openai"
            ? { Authorization: `Bearer ${key}` }
            : {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": "places.id",
              },
        ...(provider === "google"
          ? { body: JSON.stringify({ textQuery: "Paris France", pageSize: 1, languageCode: "fr" }) }
          : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
  } catch (error) {
    if (provider === "google") return respond(googleTransportError(error), 503);
    throw error;
  }
  if (!response.ok && provider === "google") return respond(await googleApiError(response), 502);
  // Never relay vendor response bodies: they can contain credentials or account details.
  await response.body?.cancel();
  if (!response.ok)
    return respond(
      {
        error:
          response.status === 429
            ? "Quota atteint. Vérifiez la facturation et les limites de votre compte."
            : provider === "openai"
              ? "Clé ou modèle OpenAI refusé. Vérifiez les permissions du projet et le modèle choisi."
              : "Google Places refuse la requête. Vérifiez la clé, ses restrictions, Places API (New) et la facturation.",
      },
      502,
    );
  return respond({
    message:
      provider === "openai"
        ? "Clé acceptée et modèle accessible. Les recherches et brouillons nécessitent aussi du crédit API et les permissions Responses."
        : "Clé acceptée : Places API (New) répond.",
  });
}

export async function handleConnections(request: Request, ownerId: string | null) {
  if (!ownerId) return respond({ error: "Connexion requise." }, 401);
  if (request.method !== "GET" && !sameOrigin(request))
    return respond({ error: "Origine non autorisée." }, 403);
  try {
    if (request.method === "GET") {
      const provider = providerSchema.safeParse(new URL(request.url).searchParams.get("provider"));
      if (!provider.success) return respond({ error: "Connexion inconnue." }, 422);
      return respond(await connectionConfiguration(provider.data, ownerId));
    }
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 5000) return respond({ error: "Requête trop volumineuse." }, 413);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return respond({ error: "JSON invalide." }, 400);
    }
    if (request.method === "PUT") {
      const parsed = saveSchema.safeParse(json);
      if (!parsed.success)
        return respond(
          { error: "Renseignez une clé valide et, pour OpenAI, un nom de modèle valide." },
          422,
        );
      const { provider, apiKey, model } = parsed.data;
      return respond(await saveApiCredentials(ownerId, provider, apiKey, model));
    }
    const parsed = z.object({ provider: providerSchema }).safeParse(json);
    if (!parsed.success) return respond({ error: "Connexion inconnue." }, 422);
    if (request.method === "DELETE")
      return respond(await deleteApiCredentials(ownerId, parsed.data.provider));
    if (request.method === "POST") {
      if (!startResearch(ownerId))
        return respond(
          { error: "Une vérification ou une recherche est en cours. Patientez quelques instants." },
          429,
        );
      try {
        return await verifyConnection(parsed.data.provider, ownerId);
      } finally {
        finishResearch(ownerId);
      }
    }
    return respond({ error: "Méthode non autorisée." }, 405);
  } catch {
    return respond(
      {
        error:
          "Connexion indisponible. Vérifiez la configuration du serveur ou enregistrez de nouveau la clé.",
      },
      503,
    );
  }
}
