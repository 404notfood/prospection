import { z } from "zod";
import { getMigrations } from "better-auth/db/migration";
import { createAuth } from "./auth";
import { initializeWorkspaceTable, query } from "./database";

const ownerSchema = z.object({
  email: z.email().transform((email) => email.toLowerCase()),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
});

/** Called by the installer, never exposed as a public registration endpoint. */
export async function initializeApplication(owner: z.input<typeof ownerSchema>) {
  const config = ownerSchema.parse(owner);
  const instance = createAuth(true);
  const migrations = await getMigrations(instance.options);
  await migrations.runMigrations();
  await initializeWorkspaceTable();

  const users = await query<{ id: string; email: string }>('SELECT id, email FROM "user"');
  if (users.some((user) => user.email.toLowerCase() === config.email)) return "existing";
  if (users.length)
    throw new Error(
      "Un compte existe déjà. OWNER_EMAIL doit correspondre au compte privé existant.",
    );

  await instance.api.signUpEmail({ body: config });
  return "created";
}
