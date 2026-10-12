import { Suspense } from "react";
import { CampaignsPage } from "@/components/campaigns/campaigns-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <CampaignsPage />
    </Suspense>
  );
}
