import { Suspense } from "react";
import { TemplatesPage } from "@/components/library/templates-page";
export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <TemplatesPage />
    </Suspense>
  );
}
