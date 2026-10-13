import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  apiCredentials,
  connectionConfiguration,
  saveApiCredentials,
} from "../lib/server/api-credentials";
import { handleConnections } from "../lib/server/connection-api";
import { closeDatabase, query } from "../lib/server/database";
import { researchBusiness } from "../lib/server/web-research";
import { researchWithAi } from "../lib/server/ai-research";
import { researchIdentity } from "../lib/domain/ai-research";
import { blankProspect } from "../lib/domain/defaults";

test("Clés privées : chiffrement, persistance, isolation, routes protégées et sélection des clés enregistrées", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sillage-keys-"));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    SQLITE_PATH: join(directory, "credentials.sqlite"),
    DATABASE_URL: "",
    BETTER_AUTH_SECRET: "test-secret-for-encrypted-api-keys-only",
    BETTER_AUTH_URL: "http://localhost:3000",
    OPENAI_API_KEY: "server-openai-key-only",
    GOOGLE_PLACES_API_KEY: "",
    OPENAI_MODEL: "gpt-4.1-mini",
  });
  const request = (method: string, body?: unknown, origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/connections?provider=openai", {
      method,
      headers: { Origin: origin, "Content-Type": "application/json" },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
  try {
    assert.equal((await handleConnections(request("GET"), null)).status, 401);
    assert.equal(
      (
        await handleConnections(
          request(
            "PUT",
            { provider: "openai", apiKey: "private-openai-key-only" },
            "https://foreign.example",
          ),
          "owner",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await handleConnections(
          request("PUT", { provider: "openai", apiKey: "bad\nheader-key-only" }),
          "owner",
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await handleConnections(
          request("PUT", {
            provider: "openai",
            apiKey: "private-openai-key-only",
            model: "https://foreign.example",
          }),
          "owner",
        )
      ).status,
      422,
    );
    const saved = await handleConnections(
      request("PUT", {
        provider: "openai",
        apiKey: "private-openai-key-only",
        model: "gpt-4.1-mini",
      }),
      "owner",
    );
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("cache-control"), "no-store");
    const metadata = await saved.json();
    assert.equal(metadata.source, "saved");
    assert.equal(metadata.configured, true);
    assert.equal(JSON.stringify(metadata).includes("private-openai-key-only"), false);
    await saveApiCredentials("owner", "google", "private-google-key-only");
    const [row] = await query<{ encrypted_key: string }>(
      "SELECT encrypted_key FROM api_credentials WHERE owner_id=$1 AND provider=$2",
      ["owner", "openai"],
    );
    assert.equal(row.encrypted_key.includes("private-openai-key-only"), false);
    await closeDatabase();
    assert.equal((await apiCredentials("openai", "owner")).key, "private-openai-key-only");
    assert.equal((await apiCredentials("openai", "other")).key, "server-openai-key-only");
    assert.equal((await connectionConfiguration("google", "other")).configured, false);
    const read = await handleConnections(request("GET"), "owner");
    assert.equal((await read.text()).includes("private-openai-key-only"), false);

    const calls: string[] = [];
    globalThis.fetch = (async (url, options) => {
      calls.push(String(url));
      const headers = options!.headers as Record<string, string>;
      if (String(url).includes("places.googleapis.com")) {
        assert.equal(headers["X-Goog-Api-Key"], "private-google-key-only");
        return Response.json({ places: [] });
      }
      assert.equal(headers.Authorization, "Bearer private-openai-key-only");
      if (String(url).includes("/models/")) return Response.json({ id: "gpt-4.1-mini" });
      // Exercise the real research code's authentication before its quota error path.
      return new Response("private-openai-key-only", { status: 429 });
    }) as typeof fetch;
    assert.equal(
      (await handleConnections(request("POST", { provider: "openai" }), "owner")).status,
      200,
    );
    assert.equal(
      (await handleConnections(request("POST", { provider: "openai" }), "owner")).status,
      429,
    );
    await researchBusiness(
      { name: "Atelier", city: "Laval", address: "12 Rue des Fleurs" },
      undefined,
      "owner",
    );
    await assert.rejects(
      () =>
        researchWithAi(
          [researchIdentity({ ...blankProspect(), name: "Atelier", city: "Laval" })],
          "owner",
        ),
      /Quota/,
    );
    assert.ok(calls.some((url) => url.endsWith("/responses")));

    // A ciphertext cannot be moved to another account or another provider.
    await query("UPDATE api_credentials SET encrypted_key=$1 WHERE owner_id=$2 AND provider=$3", [
      row.encrypted_key,
      "owner",
      "google",
    ]);
    await assert.rejects(() => apiCredentials("google", "owner"), /déchiffrée/);
    const originalSecret = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "a-different-encryption-secret-for-tests";
    await assert.rejects(() => apiCredentials("openai", "owner"), /déchiffrée/);
    const unavailable = await handleConnections(request("GET"), "owner");
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.text()).includes("private-openai-key-only"), false);
    process.env.BETTER_AUTH_SECRET = originalSecret;
    await handleConnections(
      request("PUT", { provider: "openai", apiKey: "replacement-openai-key-only" }),
      "owner",
    );
    assert.equal((await apiCredentials("openai", "owner")).key, "replacement-openai-key-only");
    const removed = await handleConnections(request("DELETE", { provider: "openai" }), "owner");
    assert.equal((await removed.json()).source, "server");
    assert.equal((await apiCredentials("openai", "owner")).key, "server-openai-key-only");
  } finally {
    globalThis.fetch = originalFetch;
    await closeDatabase();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(directory, { recursive: true, force: true });
  }
});
