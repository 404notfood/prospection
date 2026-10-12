import { loadEnvConfig } from "@next/env";
import { getMigrations } from "better-auth/db/migration";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createAuth } from "../lib/server/auth";
import { initializeWorkspaceTable, database } from "../lib/server/database";
import { Pool } from "pg";

loadEnvConfig(process.cwd());
const prompt = createInterface({ input: stdin, output: stdout });
try {
  const email = await prompt.question("Email du compte privé : ");
  // Pass the password through the environment: no password is echoed or stored by this script.
  const password = process.env.OWNER_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Définissez OWNER_PASSWORD (12 caractères minimum) dans l’environnement du terminal.",
    );
  const instance = createAuth(true);
  const migrations = await getMigrations(instance.options);
  await migrations.runMigrations();
  await initializeWorkspaceTable();
  await instance.api.signUpEmail({
    body: { email, password, name: "Laurent Prado" },
  });
  console.log("Compte créé. L’inscription publique reste désactivée.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Échec de la création du compte.");
  process.exitCode = 1;
} finally {
  prompt.close();
  const db = database();
  if (db instanceof Pool) await db.end();
  else db.close();
}
