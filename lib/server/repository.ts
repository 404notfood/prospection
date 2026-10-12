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
