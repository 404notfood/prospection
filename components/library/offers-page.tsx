"use client";

import { useState } from "react";
import {
  Plus,
  ArrowUpRight,
  Layers3,
  Globe2,
  SearchCheck,
  Workflow,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeading } from "@/components/shared/page-heading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FormField } from "@/components/shared/form-field";
import { Switch } from "@/components/ui/switch";
import { offerSchema, type Offer } from "@/lib/domain/schema";

const icons = [LayoutTemplate, Globe2, SearchCheck, Workflow];
export function OffersPage() {
  const { data, update, saving } = useWorkspace();
  const [draft, setDraft] = useState<Offer | null>(null);
  async function save() {
    const parsed = offerSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (
      await update(
        (workspace) => ({
          ...workspace,
          offers: workspace.offers.some((o) => o.id === parsed.data.id)
            ? workspace.offers.map((o) => (o.id === parsed.data.id ? parsed.data : o))
            : [...workspace.offers, parsed.data],
        }),
        "Prestation enregistrée",
      )
    )
      setDraft(null);
  }
  return (
    <>
      <PageHeading
        eyebrow="Votre savoir-faire"
        title="De bonnes offres font de bons échanges."
        description="Votre catalogue, vos tarifs et les engagements que vous choisissez."
        actions={
          <Button
            className="text-xs"
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                name: "",
                description: "",
                price: "Sur devis",
                conditions: "",
                enabled: true,
              })
            }
          >
            <Plus className="size-3.5" />
            Ajouter une prestation
          </Button>
        }
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.offers.map((offer, index) => {
          const Icon = icons[index % icons.length];
          return (
            <button
              key={offer.id}
              onClick={() => setDraft(offer)}
              className="panel group flex flex-col p-6 text-left hover:border-primary/30"
            >
              <div className="mb-7 flex w-full items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-[#f0f4e8] text-[#799250]">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <span
                  className={`text-[9px] ${offer.enabled ? "text-emerald-700" : "text-muted-foreground"}`}
                >
                  {offer.enabled ? "Disponible" : "Désactivée"}
                </span>
              </div>
              <h2 className="text-lg font-medium tracking-tight">{offer.name}</h2>
              <p className="mt-3 min-h-12 text-xs leading-6 text-muted-foreground">
                {offer.description}
              </p>
              <div className="my-5 w-full border-t" />
              <p className="text-sm font-medium text-primary">{offer.price || "Tarif à définir"}</p>
              <p className="mt-2 min-h-12 text-[10px] leading-5 text-muted-foreground">
                {offer.conditions || "Conditions à préciser."}
              </p>
              <div className="mt-5 flex w-full items-center justify-between text-[10px] text-muted-foreground">
                <span>Affiner la prestation</span>
                <ArrowUpRight className="size-4 group-hover:text-primary" />
              </div>
            </button>
          );
        })}
        <button
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              price: "Sur devis",
              conditions: "",
              enabled: true,
            })
          }
          className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-muted-foreground hover:border-primary/40"
        >
          <Layers3 className="mb-4 size-6" strokeWidth={1.5} />
          <span className="text-xs">Un autre savoir-faire à proposer ?</span>
          <span className="mt-3 text-[10px] text-primary">Ajouter une prestation +</span>
        </button>
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Les montants préremplis reprennent les repères indicatifs du cadrage. Précisez HT/TTC,
        périmètre et récurrence avant de les utiliser dans une proposition.
      </p>
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>Une offre claire, à votre image.</DialogTitle>
          <DialogDescription>
            Définissez ce que vous proposez et dans quelles conditions.
          </DialogDescription>
          {draft && (
            <div className="space-y-4">
              <FormField
                label="Nom de la prestation"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
              />
              <FormField
                label="Description & arguments"
                multiline
                rows={3}
                value={draft.description}
                onChange={(v) => setDraft({ ...draft, description: v })}
              />
              <FormField
                label="Tarif ou fourchette"
                value={draft.price}
                onChange={(v) => setDraft({ ...draft, price: v })}
              />
              <FormField
                label="Conditions, options et limites"
                multiline
                rows={3}
                value={draft.conditions}
                onChange={(v) => setDraft({ ...draft, conditions: v })}
              />
              <div className="flex items-center justify-between">
                <label htmlFor="offer-active" className="text-xs">
                  Disponible pour les campagnes
                </label>
                <Switch
                  id="offer-active"
                  checked={draft.enabled}
                  onCheckedChange={(v) => setDraft({ ...draft, enabled: v })}
                />
              </div>
              <Button className="mt-2 w-full" disabled={saving} onClick={save}>
                Enregistrer la prestation
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
