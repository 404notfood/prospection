import { Suspense } from "react";
import { SettingsPage } from "@/components/settings/settings-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <SettingsPage />
    </Suspense>
  );
}
