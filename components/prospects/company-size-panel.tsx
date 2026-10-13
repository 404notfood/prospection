"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Prospect } from "@/lib/domain/schema";
import { currentCompanySize, employeeRanges } from "@/lib/domain/company-size";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "@/components/shared/external-link";
import { useWorkspace } from "@/components/workspace/workspace-provider";

export function CompanySizePanel({
  prospect,
  canVerify,
  onVerified,
}: {
  prospect: Prospect;
  canVerify: boolean;
  onVerified: (prospect: Prospect) => void;
}) {
  const [busy, setBusy] = useState(false);
  const { refresh } = useWorkspace();
  const size = currentCompanySize(prospect);
  async function verify() {
    setBusy(true);
    try {
      const response = await fetch("/api/company-size", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Contrôle indisponible.");
      onVerified(result.prospect);
      await refresh();
      if (result.prospect.companySize.status === "uncertain")
        toast.warning(result.prospect.companySize.reason);
      else toast.success("Taille de l’entreprise vérifiée dans la source publique.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Contrôle indisponible.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-xs font-semibold">Taille de l’entreprise</h3>
      <p className="text-xs">
        {size.status === "small"
          ? "TPE / PME · plafond de 30 salariés confirmé"
          : size.status === "large"
            ? "Hors cible · plafond de 30 salariés ou catégorie GE/ETI"
            : "Taille à vérifier"}
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {size.reason ||
          "Ce contrôle porte sur l’entreprise entière, pas uniquement sur son agence locale."}
      </p>
      {size.category !== "unknown" && (
        <p className="text-[10px] text-muted-foreground">
          Catégorie INSEE : {size.category}
          {size.categoryYear ? ` · données ${size.categoryYear}` : ""}
        </p>
      )}
      {employeeRanges[size.employeeRange] && (
        <p className="text-[10px] text-muted-foreground">
          {employeeRanges[size.employeeRange]}
          {size.employeeYear ? ` · données ${size.employeeYear}` : ""}
        </p>
      )}
      <ExternalLink url={size.sourceUrl}>Consulter la source entreprise</ExternalLink>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !canVerify || !prospect.siren}
        onClick={() => void verify()}
      >
        {busy ? "Vérification…" : "Vérifier la taille"}
      </Button>
      {(!canVerify || !prospect.siren) && (
        <p className="text-[10px] text-muted-foreground">
          Enregistrez la fiche avec son SIREN avant de vérifier la taille.
        </p>
      )}
    </section>
  );
}
