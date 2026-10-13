import { z } from "zod";

const setupUrl = "https://developers.google.com/maps/documentation/places/web-service/get-api-key";
const securityUrl = "https://developers.google.com/maps/api-security-best-practices";
const reasons: Record<string, { error: string; helpUrl?: string }> = {
  SERVICE_DISABLED: {
    error:
      "Places API (New) n’est pas activée pour le projet de cette clé. Activez places.googleapis.com dans ce même projet Google Cloud.",
  },
  BILLING_DISABLED: {
    error:
      "La facturation Google Cloud est désactivée pour le projet de cette clé. Associez un compte de facturation actif à ce projet.",
  },
  API_KEY_INVALID: {
    error:
      "Google ne reconnaît pas cette clé API. Vérifiez que vous avez copié la clé Google Cloud complète, puis enregistrez-la à nouveau.",
  },
  API_KEY_EXPIRED: {
    error: "La clé Google a expiré. Enregistrez une clé valide dans les paramètres.",
  },
  API_KEY_NOT_FOUND: {
    error:
      "Cette clé n’est plus reconnue par Google. Vérifiez la clé dans Google Cloud, puis enregistrez-la à nouveau.",
  },
  API_KEY_SERVICE_BLOCKED: {
    error:
      "Les restrictions de cette clé interdisent Places API (New). Dans Google Cloud → Identifiants → votre clé → Restrictions d’API, autorisez Places API (New).",
    helpUrl: securityUrl,
  },
  API_KEY_HTTP_REFERRER_BLOCKED: {
    error:
      "Cette clé est restreinte aux sites web. Les recherches partent du VPS : utilisez une clé serveur restreinte à l’adresse IP publique de sortie du VPS et à Places API (New).",
    helpUrl: securityUrl,
  },
  API_KEY_IP_ADDRESS_BLOCKED: {
    error:
      "L’adresse IP de sortie du VPS n’est pas autorisée pour cette clé. Ajoutez son IP publique aux restrictions Google Cloud ; vérifiez IPv4 et IPv6 si le serveur utilise les deux.",
    helpUrl: securityUrl,
  },
  API_KEY_ANDROID_APP_BLOCKED: {
    error:
      "Cette clé est réservée à Android. Utilisez une clé serveur restreinte à l’IP publique du VPS et à Places API (New).",
    helpUrl: securityUrl,
  },
  API_KEY_IOS_APP_BLOCKED: {
    error:
      "Cette clé est réservée à iOS. Utilisez une clé serveur restreinte à l’IP publique du VPS et à Places API (New).",
    helpUrl: securityUrl,
  },
  CONSUMER_INVALID: {
    error:
      "Le projet Google associé à cette clé n’est pas utilisable. Vérifiez que ce projet existe et qu’il est actif.",
  },
  RATE_LIMIT_EXCEEDED: {
    error:
      "Une limite de requêtes Google Places est atteinte. Patientez, puis vérifiez les quotas Places API (New) du projet.",
  },
  RESOURCE_QUOTA_EXCEEDED: {
    error:
      "Un quota du projet Google est épuisé. Vérifiez les quotas Places API (New) avant de réessayer.",
  },
};
const payloadSchema = z.object({
  error: z.object({
    status: z.string().optional(),
    message: z.string().optional(),
    details: z
      .array(
        z.object({
          "@type": z.string().optional(),
          reason: z.string().optional(),
          domain: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export async function googleApiError(response: Response) {
  const payload = payloadSchema.safeParse(await response.json().catch(() => null));
  const error = payload.success ? payload.data.error : null;
  const reason = error?.details?.find(
    (detail) =>
      detail["@type"] === "type.googleapis.com/google.rpc.ErrorInfo" &&
      detail.domain === "googleapis.com" &&
      detail.reason &&
      Object.hasOwn(reasons, detail.reason),
  )?.reason;
  let code = reason || "GOOGLE_REQUEST_REJECTED";
  // Use text only to classify known failures; never expose provider messages or metadata.
  if (!reason) {
    const message = error?.message || "";
    if (/billing.*(?:disabled|enable|account)|enable.*billing/i.test(message))
      code = "BILLING_DISABLED";
    else if (/api key (?:not valid|is invalid|invalid)/i.test(message)) code = "API_KEY_INVALID";
    else if (/refer(?:r)?er.*blocked|refer(?:r)?er restrictions/i.test(message))
      code = "API_KEY_HTTP_REFERRER_BLOCKED";
    else if (/has not been used.*before|service.*disabled|api.*not enabled/i.test(message))
      code = "SERVICE_DISABLED";
    else if (response.status === 429 || error?.status === "RESOURCE_EXHAUSTED")
      code = "GOOGLE_QUOTA_EXHAUSTED";
    else if (response.status === 401) code = "API_KEY_INVALID";
    else if (response.status === 400) code = "GOOGLE_INVALID_REQUEST";
    else if (response.status >= 500) code = "GOOGLE_UNAVAILABLE";
  }
  const known = Object.hasOwn(reasons, code) ? reasons[code] : undefined;
  return {
    provider: "google" as const,
    code,
    upstreamStatus: response.status,
    error:
      known?.error ||
      (code === "GOOGLE_QUOTA_EXHAUSTED"
        ? "Le quota Google Places est atteint. Vérifiez les quotas et la facturation du projet avant de réessayer."
        : code === "GOOGLE_INVALID_REQUEST"
          ? "Google refuse le format de la requête Places. Le problème peut venir de l’application ; transmettez ce diagnostic à l’assistance."
          : code === "GOOGLE_UNAVAILABLE"
            ? "Google Places est momentanément indisponible. Réessayez plus tard."
            : "Google refuse la requête sans préciser une cause reconnue. Vérifiez l’activation de Places API (New), la facturation et les restrictions de la clé dans le même projet."),
    helpUrl: known?.helpUrl || setupUrl,
  };
}

export function googleTransportError(error: unknown) {
  const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
  return {
    provider: "google" as const,
    code: timedOut ? "GOOGLE_TIMEOUT" : "GOOGLE_NETWORK_ERROR",
    upstreamStatus: null,
    error: timedOut
      ? "Google Places n’a pas répondu dans le délai prévu. Réessayez ; si cela persiste, vérifiez la connexion sortante du VPS. La validité de la clé n’a pas pu être vérifiée."
      : "Le VPS ne parvient pas à joindre Google Places. Vérifiez son accès HTTPS sortant et son DNS. La validité de la clé n’a pas pu être vérifiée.",
  };
}
