import { Suspense } from "react";
import { ProspectsPage } from "@/components/prospects/prospects-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <ProspectsPage />
    </Suspense>
  );
}
