import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { openAiConfiguration, researchWithAi } from "@/lib/server/ai-research";
import { researchIdentitySchema } from "@/lib/domain/ai-research";
import { startResearch, finishResearch } from "@/lib/server/research-lock";

export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Connexion requise." }, { status: 401 });
  return Response.json(openAiConfiguration(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 20000)
    return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON invalide." }, { status: 400 });
  }
  const parsed = researchIdentitySchema.safeParse(json);
  if (!parsed.success)
    return Response.json(
      { error: "Renseignez le nom et la ville de l’entreprise." },
      { status: 422 },
    );
  const { data } = await readWorkspace(session.user.id);
  if (!data.settings.aiResearchEnabled)
    return Response.json({ error: "Activez OpenAI dans les paramètres." }, { status: 403 });
  if (!startResearch(session.user.id))
    return Response.json(
      { error: "Une recherche est en cours. Patientez quelques instants." },
      { status: 429 },
    );
  try {
    const [result] = await researchWithAi([parsed.data], session.user.id);
    if (!result) throw new Error("OpenAI n’a pas retourné de résultat pour cette entreprise.");
    return Response.json(result.research);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "Format OpenAI inattendu."
            : error instanceof Error
              ? error.message
              : "Analyse IA indisponible.",
      },
      { status: 502 },
    );
  } finally {
    finishResearch(session.user.id);
  }
}
