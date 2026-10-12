import { cn } from "@/lib/utils";

export function Brand({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          dark ? "bg-lime-300 text-[#202923]" : "bg-[#202923] text-lime-300",
        )}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 17.5 12 5l7 12.5M8.5 15l3.5-6 3.5 6M5 17.5h14"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <div>
          <span className="block text-xl font-semibold tracking-[-.055em]">
            sillage<span className="text-lime-400">.</span>
          </span>
          <span className="block text-[9px] uppercase tracking-[.22em] opacity-45">
            par 404NotFood
          </span>
        </div>
      )}
    </div>
  );
}
