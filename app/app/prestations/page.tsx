import { Suspense } from "react";
import { OffersPage } from "@/components/library/offers-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <OffersPage />
    </Suspense>
  );
}
