import Database from "better-sqlite3";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Connection = Database.Database | Pool;
const globalDatabase = globalThis as unknown as {
  prospectDatabase?: Connection;
};

export function database(): Connection {
  if (globalDatabase.prospectDatabase) return globalDatabase.prospectDatabase;
  if (process.env.DATABASE_URL) {
    globalDatabase.prospectDatabase = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  } else {
    if (process.env.NODE_ENV === "production" && !process.env.SQLITE_PATH)
      throw new Error(
        "Configurez DATABASE_URL pour le VPS, ou SQLITE_PATH pour une installation locale explicite.",
      );
    // This is runtime data, not an asset to include in the deployment bundle.
    const path = resolve(
      /* turbopackIgnore: true */ process.env.SQLITE_PATH || "data/prospection.sqlite",
    );
    mkdirSync(dirname(path), { recursive: true });
    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    globalDatabase.prospectDatabase = sqlite;
  }
  return globalDatabase.prospectDatabase;
}

export async function query<T>(sql: string, values: (string | number)[] = []): Promise<T[]> {
  const db = database();
  if (db instanceof Pool) return (await db.query(sql, values)).rows as T[];
  const statement = db.prepare(sql.replace(/\$\d+/g, "?"));
  if (statement.reader) return statement.all(...values) as T[];
  statement.run(...values);
  return [];
}

export async function initializeWorkspaceTable() {
  await query(`CREATE TABLE IF NOT EXISTS prospect_workspace (
    owner_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`);
}

export async function closeDatabase() {
  const db = globalDatabase.prospectDatabase;
  if (!db) return;
  if (db instanceof Pool) await db.end();
  else db.close();
  delete globalDatabase.prospectDatabase;
}
