import Link from "next/link";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <p className="text-xs text-muted-foreground">404 · Un chemin de traverse</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Cette page n’est pas sur la carte.
        </h1>
        <Button asChild className="mt-8">
          <Link href="/">Retrouver mon espace</Link>
        </Button>
      </div>
    </main>
  );
}
