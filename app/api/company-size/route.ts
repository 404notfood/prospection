import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace, mutateWorkspace } from "@/lib/server/repository";
import { lookupCompanySize } from "@/lib/server/company-size";
import { applyCompanyTarget } from "@/lib/domain/company-size";
import { mergeProspectChanges } from "@/lib/domain/merge";
import { startResearch, finishResearch } from "@/lib/server/research-lock";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({ prospectId: z.string().min(1).max(240) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Prospect invalide." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  const before = data.prospects.find((p) => p.id === parsed.data.prospectId);
  if (!before) return Response.json({ error: "Prospect introuvable." }, { status: 404 });
  if (!startResearch(session.user.id))
    return Response.json(
      { error: "Une recherche est en cours. Patientez quelques instants." },
      { status: 429 },
    );
  try {
    const companySize = await lookupCompanySize(before.siren);
    const saved = await mutateWorkspace(session.user.id, (workspace) => {
      const current = workspace.prospects.find((p) => p.id === before.id);
      if (!current || current.siren !== before.siren) throw new Error("changed");
      const merged = mergeProspectChanges(current, before, { ...before, companySize });
      const campaign = workspace.campaigns.find((c) => c.id === current.campaignId);
      const next = campaign ? applyCompanyTarget(merged, campaign) : merged;
      workspace.prospects = workspace.prospects.map((p) => (p.id === current.id ? next : p));
      return workspace;
    });
    return Response.json(
      { prospect: saved.data.prospects.find((p) => p.id === before.id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "La fiche a changé ou le contrôle n’a pas pu être enregistré. Actualisez puis réessayez.",
      },
      { status: 409 },
    );
  } finally {
    finishResearch(session.user.id);
  }
}
