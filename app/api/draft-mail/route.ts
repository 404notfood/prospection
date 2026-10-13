import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace, mutateWorkspace } from "@/lib/server/repository";
import { preparePersonalizedDraft } from "@/lib/server/draft-mail";
import { canContact } from "@/lib/domain/prospects";
import { researchIdentityKey } from "@/lib/domain/ai-research";
import { startResearch, finishResearch } from "@/lib/server/research-lock";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({ prospectId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Prospect invalide." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  const before = data.prospects.find((p) => p.id === parsed.data.prospectId);
  if (!before || !canContact(before))
    return Response.json(
      { error: "Ce prospect doit être qualifié et sans opposition." },
      { status: 422 },
    );
  if (!startResearch(session.user.id))
    return Response.json({ error: "Une préparation est en cours." }, { status: 429 });
  try {
    const result = await preparePersonalizedDraft(
      { ...before, emailDraft: null },
      data,
      true,
      session.user.id,
    );
    const saved = await mutateWorkspace(session.user.id, (workspace) => {
      const current = workspace.prospects.find((p) => p.id === before.id);
      if (
        !current ||
        !canContact(current) ||
        researchIdentityKey(current) !== researchIdentityKey(before) ||
        JSON.stringify(current.emailDraft) !== JSON.stringify(before.emailDraft)
      )
        throw new Error("changed");
      current.emailDraft = result.prospect.emailDraft;
      workspace.events.unshift({
        id: crypto.randomUUID(),
        prospectId: current.id,
        campaignId: current.campaignId,
        kind: "automation",
        title: "Brouillon préparé",
        detail: current.name,
        createdAt: new Date().toISOString(),
      });
      return workspace;
    });
    return Response.json({
      draft: saved.data.prospects.find((p) => p.id === before.id)!.emailDraft,
      warning: result.warning,
    });
  } catch {
    return Response.json(
      {
        error:
          "La fiche a changé ou le brouillon n’a pas pu être enregistré. Actualisez et réessayez.",
      },
      { status: 409 },
    );
  } finally {
    finishResearch(session.user.id);
  }
}
