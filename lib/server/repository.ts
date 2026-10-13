import { emptyWorkspace } from "@/lib/domain/defaults";
import { workspaceSchema, type Workspace, type WorkspaceSnapshot } from "@/lib/domain/schema";
import { initializeWorkspaceTable, query } from "./database";

interface StoredWorkspace {
  payload: string;
  revision: number;
}

export async function readWorkspace(ownerId: string): Promise<WorkspaceSnapshot> {
  await initializeWorkspaceTable();
  const [row] = await query<StoredWorkspace>(
    "SELECT payload, revision FROM prospect_workspace WHERE owner_id = $1",
    [ownerId],
  );
  return row
    ? {
        data: workspaceSchema.parse(JSON.parse(row.payload)),
        revision: row.revision,
      }
    : { data: emptyWorkspace(), revision: 0 };
}

// A compare-and-swap prevents another tab from silently overwriting newer data.
export async function saveWorkspace(ownerId: string, data: Workspace, revision: number) {
  await initializeWorkspaceTable();
  const [saved] = await query<{ revision: number }>(
    `INSERT INTO prospect_workspace (owner_id, payload, revision, updated_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (owner_id) DO UPDATE SET payload = excluded.payload,
      revision = excluded.revision, updated_at = excluded.updated_at
    WHERE prospect_workspace.revision = $5
    RETURNING revision`,
    [ownerId, JSON.stringify(data), revision + 1, new Date().toISOString(), revision],
  );
  return saved?.revision;
}

export async function mutateWorkspace(ownerId: string, change: (data: Workspace) => Workspace) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readWorkspace(ownerId);
    const next = workspaceSchema.parse(change(structuredClone(current.data)));
    if (JSON.stringify(next) === JSON.stringify(current.data)) return current;
    const { validateWorkspace } = await import("@/lib/domain/prospects");
    const error = validateWorkspace(next);
    if (error) throw new Error(error);
    const revision = await saveWorkspace(ownerId, next, current.revision);
    if (revision !== undefined) return { data: next, revision };
  }
  throw new Error("Données modifiées simultanément. Réessayez le traitement.");
}
