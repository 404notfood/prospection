import { demoWorkspace } from "@/lib/domain/demo";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { AppShell } from "@/components/shell/app-shell";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider demo initial={{ data: demoWorkspace(), revision: 0 }}>
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
