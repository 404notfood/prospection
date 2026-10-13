import { query } from "./database";
import { readWorkspace } from "./repository";

function day() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
}
async function initializeUsage() {
  await query(`CREATE TABLE IF NOT EXISTS ai_daily_usage (owner_id TEXT NOT NULL, day TEXT NOT NULL,
    calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id, day))`);
}
export async function aiUsage(ownerId: string) {
  await initializeUsage();
  const { data } = await readWorkspace(ownerId);
  const [row] = await query<{ calls: number }>(
    "SELECT calls FROM ai_daily_usage WHERE owner_id = $1 AND day = $2",
    [ownerId, day()],
  );
  return { used: row?.calls || 0, limit: data.settings.dailyAiCalls };
}
export async function reserveAiCall(ownerId?: string) {
  if (!ownerId) return;
  await initializeUsage();
  const { data } = await readWorkspace(ownerId);
  const [row] = await query<{ calls: number }>(
    `INSERT INTO ai_daily_usage (owner_id, day, calls) VALUES ($1, $2, 1)
    ON CONFLICT(owner_id, day) DO UPDATE SET calls = ai_daily_usage.calls + 1
    WHERE ai_daily_usage.calls < $3 RETURNING calls`,
    [ownerId, day(), data.settings.dailyAiCalls],
  );
  if (!row)
    throw new Error(
      "Plafond quotidien d’appels OpenAI atteint. Aucun nouvel appel IA ne sera lancé aujourd’hui.",
    );
}
