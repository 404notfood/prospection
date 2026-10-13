import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { googleResearchConfigured, researchBusiness } from "@/lib/server/web-research";
import { startResearch, finishResearch } from "@/lib/server/research-lock";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  return Response.json(
    { configured: await googleResearchConfigured(session.user.id) },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(240),
      city: z.string().trim().min(1).max(240),
      address: z.string().trim().max(240),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Renseignez l’entreprise et la ville." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  if (!data.settings.webResearchEnabled)
    return Response.json(
      { error: "Activez la recherche Google Places dans les paramètres." },
      { status: 403 },
    );
  if (!startResearch(session.user.id))
    return Response.json(
      { error: "Une recherche est en cours. Patientez quelques instants." },
      { status: 429 },
    );
  try {
    return Response.json(await researchBusiness(parsed.data, undefined, session.user.id));
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Le format de réponse Google a changé. Réessayez plus tard."
            : error instanceof Error
              ? error.message
              : "Recherche indisponible.",
      },
      { status: 502 },
    );
  } finally {
    finishResearch(session.user.id);
  }
}
