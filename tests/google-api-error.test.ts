import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { googleApiError } from "../lib/server/google-api-error";
import { handleConnections } from "../lib/server/connection-api";
import { apiCredentials, saveApiCredentials } from "../lib/server/api-credentials";
import { closeDatabase } from "../lib/server/database";

const rejected = (reason: string, status = 403) =>
  Response.json(
    {
      error: {
        status: "PERMISSION_DENIED",
        message: "private-google-key-only projects/private-project",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            domain: "googleapis.com",
            reason,
            metadata: { apiKey: "private-google-key-only", consumer: "projects/private-project" },
          },
        ],
      },
    },
    { status },
  );

test("Google distingue API désactivée, facturation, restrictions et quotas sans divulguer les erreurs brutes", async () => {
  for (const [reason, expected] of [
    ["SERVICE_DISABLED", /n’est pas activée/],
    ["BILLING_DISABLED", /facturation.*désactivée/],
    ["API_KEY_INVALID", /ne reconnaît pas/],
    ["API_KEY_SERVICE_BLOCKED", /Restrictions d’API/],
    ["API_KEY_HTTP_REFERRER_BLOCKED", /restreinte aux sites web/],
    ["API_KEY_IP_ADDRESS_BLOCKED", /IP.*pas autorisée/],
    ["RATE_LIMIT_EXCEEDED", /limite de requêtes/],
    ["RESOURCE_QUOTA_EXCEEDED", /quota.*épuisé/],
  ] as const) {
    const result = await googleApiError(rejected(reason));
    assert.equal(result.code, reason);
    assert.match(result.error, expected);
    assert.equal(result.upstreamStatus, 403);
    assert.ok(!JSON.stringify(result).includes("private-google-key-only"));
    assert.ok(!JSON.stringify(result).includes("private-project"));
  }
  const unknown = await googleApiError(rejected("private-google-key-only"));
  assert.equal(unknown.code, "GOOGLE_REQUEST_REJECTED");
  assert.ok(!JSON.stringify(unknown).includes("private-google-key-only"));
  const quota = await googleApiError(new Response("private-google-key-only", { status: 429 }));
  assert.equal(quota.code, "GOOGLE_QUOTA_EXHAUSTED");
  const invalid = await googleApiError(
    Response.json(
      { error: { message: "API key not valid. Please pass a valid API key." } },
      { status: 400 },
    ),
  );
  assert.equal(invalid.code, "API_KEY_INVALID");
  const billing = await googleApiError(
    Response.json(
      { error: { message: "You must enable Billing on the Google Cloud Project." } },
      { status: 403 },
    ),
  );
  assert.equal(billing.code, "BILLING_DISABLED");
  const server = await googleApiError(
    new Response("<html>private-google-key-only</html>", { status: 500 }),
  );
  assert.equal(server.code, "GOOGLE_UNAVAILABLE");
});

test("La vérification Google conserve la clé et retourne un diagnostic sûr ; réseau et refus restent distincts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-google-error-"));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    SQLITE_PATH: join(directory, "test.sqlite"),
    DATABASE_URL: "",
    BETTER_AUTH_SECRET: "test-secret-for-google-verification-only",
    BETTER_AUTH_URL: "http://localhost:3000",
    GOOGLE_PLACES_API_KEY: "private-google-key-only",
  });
  const request = () =>
    new Request("http://localhost:3000/api/connections", {
      method: "POST",
      headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google" }),
    });
  try {
    await saveApiCredentials("google-owner", "google", "private-google-key-only");
    globalThis.fetch = (async (url, options) => {
      assert.equal(String(url), "https://places.googleapis.com/v1/places:searchText");
      assert.equal(
        (options!.headers as Record<string, string>)["X-Goog-Api-Key"],
        "private-google-key-only",
      );
      return rejected("API_KEY_HTTP_REFERRER_BLOCKED");
    }) as typeof fetch;
    const response = await handleConnections(request(), "google-owner");
    assert.equal(response.status, 502);
    const diagnostic = await response.json();
    assert.equal(diagnostic.code, "API_KEY_HTTP_REFERRER_BLOCKED");
    assert.ok(!JSON.stringify(diagnostic).includes("private-google-key-only"));
    assert.equal((await apiCredentials("google", "google-owner")).key, "private-google-key-only");
    globalThis.fetch = (async () => {
      throw new DOMException("private-google-key-only", "TimeoutError");
    }) as typeof fetch;
    const timedOut = await handleConnections(request(), "timeout-owner");
    assert.equal(timedOut.status, 503);
    assert.equal((await timedOut.json()).code, "GOOGLE_TIMEOUT");
    globalThis.fetch = (async () => {
      throw new TypeError("private-google-key-only");
    }) as typeof fetch;
    const network = await handleConnections(request(), "network-owner");
    const failure = await network.json();
    assert.equal(failure.code, "GOOGLE_NETWORK_ERROR");
    assert.equal(failure.upstreamStatus, null);
    assert.ok(!JSON.stringify(failure).includes("private-google-key-only"));
    globalThis.fetch = (async () => Response.json({ places: [] })) as typeof fetch;
    const success = await handleConnections(request(), "success-owner");
    assert.equal(success.status, 200);
    assert.match((await success.json()).message, /Clé acceptée/);
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
