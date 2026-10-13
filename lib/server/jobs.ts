import { z } from "zod";
import { query } from "./database";
import { campaignTarget } from "@/lib/domain/automation";
import type { Campaign } from "@/lib/domain/schema";

export const jobSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  campaignId: z.string(),
  state: z.enum(["queued", "running", "paused", "completed", "failed", "cancelled"]),
  mode: z.enum(["discover", "process"]),
  target: z.string(),
  startPage: z.number(),
  pageLimit: z.number(),
  prospectLimit: z.number(),
  aiLimit: z.number(),
  pages: z.number().default(0),
  ids: z.array(z.string()).default([]),
  processed: z.number().default(0),
  added: z.number().default(0),
  qualified: z.number().default(0),
  drafts: z.number().default(0),
  aiCalls: z.number().default(0),
  stage: z.enum(["discovery", "prospects", "finished"]),
  warnings: z.array(z.string()).default([]),
  error: z.string().default(""),
  createdAt: z.string(),
  updatedAt: z.string(),
  aiUnavailable: z.boolean().default(false),
  googleUnavailable: z.boolean().default(false),
});
export type AutomationJob = z.infer<typeof jobSchema>;
type Row = { payload: string; state: AutomationJob["state"]; lease_token: string };
export async function initializeJobs() {
  await query(`CREATE TABLE IF NOT EXISTS automation_jobs (
    id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    state TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
    lease_token TEXT NOT NULL DEFAULT '', lease_until TEXT NOT NULL DEFAULT ''
  )`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS automation_campaign_active ON automation_jobs(owner_id, campaign_id)
    WHERE state IN ('queued', 'running', 'paused')`);
  await query(
    `CREATE UNIQUE INDEX IF NOT EXISTS automation_owner_running ON automation_jobs(owner_id) WHERE state = 'running'`,
  );
  await query(
    `CREATE TABLE IF NOT EXISTS automation_worker (id TEXT PRIMARY KEY, updated_at TEXT NOT NULL)`,
  );
}
function decode(row: Row): AutomationJob {
  return jobSchema.parse({ ...JSON.parse(row.payload), state: row.state });
}
export async function listJobs(ownerId: string) {
  await initializeJobs();
  return (
    await query<Row>(
      "SELECT payload, state, lease_token FROM automation_jobs WHERE owner_id = $1 ORDER BY CASE WHEN state IN ('queued', 'running', 'paused') THEN 0 ELSE 1 END, created_at DESC LIMIT 250",
      [ownerId],
    )
  ).map(decode);
}
export async function enqueueJob(ownerId: string, campaign: Campaign, mode: AutomationJob["mode"]) {
  await initializeJobs();
  const now = new Date().toISOString();
  const job = jobSchema.parse({
    id: crypto.randomUUID(),
    ownerId,
    campaignId: campaign.id,
    state: "queued",
    mode,
    target: campaignTarget(campaign),
    startPage: campaign.searchPage,
    pageLimit: campaign.automation.maxPages,
    prospectLimit: campaign.automation.maxProspects,
    aiLimit: campaign.automation.maxAiCalls,
    stage: mode === "discover" ? "discovery" : "prospects",
    createdAt: now,
    updatedAt: now,
  });
  const inserted = await query<Row>(
    `INSERT INTO automation_jobs (id, owner_id, campaign_id, state, payload, created_at)
    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING payload, state, lease_token`,
    [job.id, ownerId, campaign.id, job.state, JSON.stringify(job), now],
  );
  return inserted[0]
    ? decode(inserted[0])
    : (await listJobs(ownerId)).find(
        (j) => j.campaignId === campaign.id && ["queued", "running", "paused"].includes(j.state),
      )!;
}
export async function claimJob() {
  await initializeJobs();
  const now = new Date().toISOString();
  const token = crypto.randomUUID();
  try {
    const [row] = await query<Row>(
      `UPDATE automation_jobs SET state = 'running', lease_token = $1, lease_until = $2
      WHERE id = (SELECT j.id FROM automation_jobs j WHERE
        (j.state = 'queued' OR (j.state = 'running' AND j.lease_until < $3))
        AND NOT EXISTS (SELECT 1 FROM automation_jobs other WHERE other.owner_id = j.owner_id
          AND other.state = 'running' AND other.id <> j.id)
        ORDER BY j.created_at LIMIT 1)
      AND (state = 'queued' OR (state = 'running' AND lease_until < $4))
      RETURNING payload, state, lease_token`,
      [token, new Date(Date.now() + 120000).toISOString(), now, now],
    );
    return row ? { job: decode(row), token } : null;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return null;
    throw error;
  }
}
export async function checkpoint(job: AutomationJob, token: string) {
  job.updatedAt = new Date().toISOString();
  job.warnings = [...new Set(job.warnings)].slice(-20);
  const [row] = await query<{ id: string }>(
    `UPDATE automation_jobs SET payload = $1, state = $2, lease_until = $3
    WHERE id = $4 AND state = 'running' AND lease_token = $5 RETURNING id`,
    [JSON.stringify(job), job.state, new Date(Date.now() + 120000).toISOString(), job.id, token],
  );
  return !!row;
}
export async function jobIsRunning(id: string, token: string) {
  const [row] = await query<{ id: string }>(
    "SELECT id FROM automation_jobs WHERE id = $1 AND state = 'running' AND lease_token = $2",
    [id, token],
  );
  return !!row;
}
export async function heartbeat(id?: string, token?: string) {
  const now = new Date().toISOString();
  await query(
    `INSERT INTO automation_worker (id, updated_at) VALUES ('main', $1)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`,
    [now],
  );
  if (id && token)
    await query(
      "UPDATE automation_jobs SET lease_until = $1 WHERE id = $2 AND lease_token = $3 AND state = 'running'",
      [new Date(Date.now() + 120000).toISOString(), id, token],
    );
}
export async function workerOnline() {
  await initializeJobs();
  const [row] = await query<{ updated_at: string }>(
    "SELECT updated_at FROM automation_worker WHERE id = 'main'",
  );
  return !!row && Date.now() - Date.parse(row.updated_at) < 45000;
}
export async function controlJob(
  ownerId: string,
  id: string,
  action: "pause" | "resume" | "cancel",
) {
  await initializeJobs();
  const [row] = await query<Row>(
    "SELECT payload, state, lease_token FROM automation_jobs WHERE owner_id = $1 AND id = $2",
    [ownerId, id],
  );
  if (!row) throw new Error("Traitement introuvable.");
  const job = decode(row);
  const allowed =
    action === "resume" ? ["paused", "failed"] : ["queued", "running", "paused", "failed"];
  if (!allowed.includes(job.state))
    throw new Error("Ce traitement ne peut pas recevoir cette action.");
  const state = action === "pause" ? "paused" : action === "cancel" ? "cancelled" : "queued";
  const next = {
    ...job,
    state,
    error: action === "resume" ? "" : job.error,
    updatedAt: new Date().toISOString(),
  };
  const [updated] = await query<{ id: string }>(
    "UPDATE automation_jobs SET state = $1, payload = $2, lease_token = '', lease_until = '' WHERE id = $3 AND owner_id = $4 AND state = $5 RETURNING id",
    [state, JSON.stringify(next), id, ownerId, job.state],
  );
  if (!updated) throw new Error("Le traitement a changé. Actualisez son état.");
  return next;
}
