import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { discover } from "@/lib/server/discovery";
import { deduplicate } from "@/lib/domain/prospects";
import { enrichProspects, googleResearchConfigured } from "@/lib/server/web-research";
import { startResearch, finishResearch } from "@/lib/server/research-lock";
import { enrichProspectsWithAi } from "@/lib/server/ai-research";
import { currentCompanySize } from "@/lib/domain/company-size";
import { listJobs } from "@/lib/server/jobs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({ campaignId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Campagne invalide." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  const campaign = data.campaigns.find((c) => c.id === parsed.data.campaignId);
  if (
    (await listJobs(session.user.id)).some(
      (j) => j.campaignId === parsed.data.campaignId && ["queued", "running"].includes(j.state),
    )
  )
    return Response.json(
      {
        error:
          "Un parcours automatique traite déjà cette campagne. Attendez sa fin ou mettez-le en pause.",
      },
      { status: 409 },
    );
  if (!data.settings.discoveryEnabled)
    return Response.json(
      { error: "Activez la source publique dans les paramètres." },
      { status: 403 },
    );
  if (!campaign || campaign.state !== "active" || campaign.searchExhausted)
    return Response.json(
      { error: "Cette campagne ne peut pas lancer de recherche." },
      { status: 422 },
    );
  if (!startResearch(session.user.id))
    return Response.json(
      { error: "Une recherche est en cours. Patientez avant de lancer le lot suivant." },
      { status: 429 },
    );
  try {
    const result = await discover(campaign);
    result.prospects = deduplicate(data.prospects, result.prospects);
    const researchable =
      campaign.companyTarget === "small"
        ? result.prospects.filter((p) => currentCompanySize(p).status === "small")
        : result.prospects;
    const aiTask = data.settings.aiResearchEnabled
      ? enrichProspectsWithAi(researchable, data.settings.aiBatchSize, session.user.id)
      : null;
    if (data.settings.webResearchEnabled) {
      if (await googleResearchConfigured(session.user.id)) {
        const enriched = await enrichProspects(researchable, session.user.id);
        const byId = new Map(enriched.prospects.map((p) => [p.id, p]));
        result.prospects = result.prospects.map((p) => byId.get(p.id) || p);
        result.warnings.push(...enriched.warnings);
      } else
        result.warnings.push(
          "Google Places n’est pas configuré : sites et fiches Google restent à rechercher depuis les fiches prospects.",
        );
    }
    if (aiTask) {
      const analysis = await aiTask;
      const byId = new Map(analysis.prospects.map((p) => [p.id, p.aiResearch]));
      result.prospects = result.prospects.map((p) => ({
        ...p,
        aiResearch: byId.get(p.id) || null,
      }));
      result.warnings.push(...analysis.warnings);
    }
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Le format de réponse de la source a changé. Réessayez plus tard."
            : error instanceof Error
              ? error.message
              : "La recherche a échoué.",
      },
      { status: 502 },
    );
  } finally {
    finishResearch(session.user.id);
  }
}
