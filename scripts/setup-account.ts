import { loadEnvConfig } from "@next/env";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { initializeApplication } from "../lib/server/bootstrap";
import { closeDatabase } from "../lib/server/database";

async function main() {
  loadEnvConfig(process.cwd());
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const email = process.env.OWNER_EMAIL || (await prompt.question("Email du compte privé : "));
    const password = process.env.OWNER_PASSWORD;
    if (!password || password.length < 12)
      throw new Error(
        "Définissez OWNER_PASSWORD (12 caractères minimum) dans l’environnement du terminal.",
      );
    const result = await initializeApplication({
      email,
      password,
      name: process.env.OWNER_NAME || "Laurent Prado",
    });
    console.log(
      result === "created"
        ? "Compte créé. L’inscription publique reste désactivée."
        : "Compte existant conservé. Son mot de passe reste inchangé.",
    );
  } catch {
    console.error(
      "Initialisation interrompue. Vérifiez la configuration de la base et du compte privé. Aucun secret n’est affiché.",
    );
    process.exitCode = 1;
  } finally {
    prompt.close();
    await closeDatabase();
  }
}

void main().catch(() => {
  console.error("Impossible de terminer l’initialisation du compte. Aucun secret n’est affiché.");
  process.exitCode = 1;
});
