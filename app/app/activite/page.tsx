import { Suspense } from "react";
import { ActivityPage } from "@/components/activity/activity-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <ActivityPage />
    </Suspense>
  );
}
