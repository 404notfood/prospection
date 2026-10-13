import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { database, query } from "./database";

export type ApiProvider = "openai" | "google";
type StoredCredential = { encrypted_key: string; model: string; updated_at: string };

const initialization = new WeakMap<object, Promise<void>>();
function initialize() {
  const connection = database();
  let pending = initialization.get(connection);
  if (!pending) {
    pending = query(`CREATE TABLE IF NOT EXISTS api_credentials (
    owner_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, provider)
  )`)
      .then(() => undefined)
      .catch(async (error: unknown) => {
        // A second process may have created the table concurrently in PostgreSQL.
        try {
          await query("SELECT owner_id FROM api_credentials LIMIT 1");
        } catch {
          initialization.delete(connection);
          throw error;
        }
      });
    initialization.set(connection, pending);
  }
  return pending;
}

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Chiffrement des clés indisponible.");
  return Buffer.from(hkdfSync("sha256", secret, "sillage-api-credentials", "aes-256-gcm-v1", 32));
}

function encrypt(key: string, ownerId: string, provider: ApiProvider) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([ownerId, provider])));
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

function decrypt(value: string, ownerId: string, provider: ApiProvider) {
  try {
    const [version, iv, tag, payload] = value.split(".");
    if (version !== "v1" || !iv || !tag || !payload) throw new Error();
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
    cipher.setAAD(Buffer.from(JSON.stringify([ownerId, provider])));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([cipher.update(Buffer.from(payload, "base64")), cipher.final()]).toString(
      "utf8",
    );
  } catch {
    throw new Error(
      "La clé enregistrée ne peut plus être déchiffrée. Enregistrez-la à nouveau dans les paramètres.",
    );
  }
}

export async function apiCredentials(provider: ApiProvider, ownerId?: string) {
  let stored: StoredCredential | undefined;
  if (ownerId) {
    await initialize();
    [stored] = await query<StoredCredential>(
      "SELECT encrypted_key, model, updated_at FROM api_credentials WHERE owner_id=$1 AND provider=$2",
      [ownerId, provider],
    );
  }
  const environmentKey =
    (provider === "openai"
      ? process.env.OPENAI_API_KEY
      : process.env.GOOGLE_PLACES_API_KEY
    )?.trim() || "";
  return {
    key: stored ? decrypt(stored.encrypted_key, ownerId!, provider) : environmentKey,
    source: stored ? ("saved" as const) : environmentKey ? ("server" as const) : ("none" as const),
    model:
      provider === "openai"
        ? stored?.model || process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini"
        : "",
    updatedAt: stored?.updated_at || "",
  };
}

export async function connectionConfiguration(provider: ApiProvider, ownerId?: string) {
  const { key, ...metadata } = await apiCredentials(provider, ownerId);
  return { ...metadata, configured: !!key };
}

export async function saveApiCredentials(
  ownerId: string,
  provider: ApiProvider,
  key?: string,
  model?: string,
) {
  const current = await apiCredentials(provider, ownerId).catch(() => null);
  const selectedKey = key || current?.key;
  if (!selectedKey) throw new Error("Renseignez une clé API avant d’enregistrer.");
  const encrypted = encrypt(selectedKey, ownerId, provider);
  await query(
    `INSERT INTO api_credentials (owner_id, provider, encrypted_key, model, updated_at)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT (owner_id, provider) DO UPDATE SET
    encrypted_key=excluded.encrypted_key, model=excluded.model, updated_at=excluded.updated_at`,
    [
      ownerId,
      provider,
      encrypted,
      provider === "openai" ? (model ?? current?.model ?? "gpt-4.1-mini") : "",
      new Date().toISOString(),
    ],
  );
  return connectionConfiguration(provider, ownerId);
}

export async function deleteApiCredentials(ownerId: string, provider: ApiProvider) {
  await initialize();
  await query("DELETE FROM api_credentials WHERE owner_id=$1 AND provider=$2", [ownerId, provider]);
  return connectionConfiguration(provider, ownerId);
}
