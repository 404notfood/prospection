import { ArrowUpRight } from "lucide-react";
import { webUrl } from "@/lib/domain/urls";
import { cn } from "@/lib/utils";

export function ExternalLink({
  url,
  children,
  className,
}: {
  url: string;
  children: React.ReactNode;
  className?: string;
}) {
  const href = webUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${typeof children === "string" ? children : "Ouvrir le lien"} (nouvel onglet)`}
      className={cn(
        "inline-flex items-center gap-1 rounded text-[11px] text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-3" aria-hidden="true" />
    </a>
  );
}
