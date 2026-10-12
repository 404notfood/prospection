import { statusColors, statusLabels } from "@/lib/domain/prospects";
import type { ProspectStatus } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium",
        statusColors[status],
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-60" />
      {statusLabels[status]}
    </span>
  );
}
