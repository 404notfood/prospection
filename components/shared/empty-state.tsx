import { ScanLine } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-60 place-items-center rounded-xl border border-dashed bg-white/50 p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl border bg-white">
          <ScanLine className="size-5 text-emerald-700" />
        </div>
        <h3 className="text-base font-medium tracking-tight">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
