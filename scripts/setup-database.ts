import { loadEnvConfig } from "@next/env";
import { initializeApplication } from "../lib/server/bootstrap";
import { closeDatabase } from "../lib/server/database";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (!email || !password)
      throw new Error(
        "OWNER_EMAIL et OWNER_PASSWORD sont nécessaires pour initialiser le compte privé.",
      );
    const result = await initializeApplication({
      email,
      password,
      name: process.env.OWNER_NAME || "Laurent Prado",
    });
    console.log(
      result === "created"
        ? "Base initialisée et compte privé créé. Aucun mot de passe affiché."
        : "Base vérifiée. Le compte privé existant et son mot de passe sont conservés.",
    );
  } catch {
    // Database errors can contain connection details; never leak them into installation logs.
    console.error(
      "Initialisation interrompue. Vérifiez la connexion PostgreSQL, BETTER_AUTH_SECRET et les variables OWNER_EMAIL / OWNER_PASSWORD. Aucun secret n’est affiché.",
    );
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

void main().catch(() => {
  console.error("Impossible de terminer l’initialisation de la base. Aucun secret n’est affiché.");
  process.exitCode = 1;
});
