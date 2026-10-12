import { requireSession } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { AppShell } from "@/components/shell/app-shell";
export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const initial = await readWorkspace(session.user.id);
  return (
    <WorkspaceProvider demo={false} initial={initial}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
