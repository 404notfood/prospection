"use client";

import { useRef } from "react";
import { Download, Upload, RotateCcw, Database } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { workspaceSchema } from "@/lib/domain/schema";
import { downloadFile } from "@/lib/domain/export";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

export function BackupPanel() {
  const { data, update, demo, resetDemo, saving } = useWorkspace();
  const input = useRef<HTMLInputElement>(null);
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8_000_000) throw new Error("Le fichier dépasse 8 Mo.");
      const raw = JSON.parse(await file.text());
      if (raw.format !== "sillage-v1") throw new Error("Format de sauvegarde non reconnu.");
      if (!demo && raw.demo)
        throw new Error(
          "Une sauvegarde de démonstration ne peut pas être importée dans l’espace privé.",
        );
      const parsed = workspaceSchema.parse(raw.data);
      await update(() => parsed, "Sauvegarde restaurée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fichier invalide.");
    }
    if (input.current) input.current.value = "";
  }
  return (
    <section className="panel p-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Database className="size-4 text-primary" />
        Vos données vous appartiennent
      </h2>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Exportez votre espace complet ou restaurez une sauvegarde. La restauration remplace les
        données actuelles.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            downloadFile(
              JSON.stringify(
                {
                  format: "sillage-v1",
                  demo,
                  exportedAt: new Date().toISOString(),
                  data,
                },
                null,
                2,
              ),
              "sillage-sauvegarde.json",
              "application/json",
            )
          }
        >
          <Download className="size-3.5" />
          Sauvegarder
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={saving}>
              <Upload className="size-3.5" />
              Restaurer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Restaurer votre espace</DialogTitle>
            <DialogDescription>
              Le fichier choisi remplacera vos prospects, campagnes, modèles et paramètres actuels.
              Exportez d’abord vos données si vous souhaitez les conserver.
            </DialogDescription>
            <DialogClose asChild>
              <Button onClick={() => input.current?.click()}>Choisir une sauvegarde JSON</Button>
            </DialogClose>
          </DialogContent>
        </Dialog>
        {demo && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <RotateCcw className="size-3.5" />
                Réinitialiser la démo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Repartir de la démonstration initiale ?</DialogTitle>
              <DialogDescription>
                Vos essais dans ce navigateur seront remplacés par le jeu de données fictives
                d’origine.
              </DialogDescription>
              <DialogClose asChild>
                <Button onClick={resetDemo}>Réinitialiser</Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Importer une sauvegarde"
        onChange={(e) => importBackup(e.target.files?.[0])}
      />
    </section>
  );
}
