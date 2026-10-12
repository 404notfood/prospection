import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { discover } from "@/lib/server/discovery";

const running = new Set<string>();
const lastCalls = new Map<string, number>();

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (running.has(session.user.id) || Date.now() - (lastCalls.get(session.user.id) || 0) < 1500)
    return Response.json(
      {
        error: "Une recherche est en cours. Patientez avant de lancer le lot suivant.",
      },
      { status: 429 },
    );
  const parsed = z
    .object({ campaignId: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Campagne invalide." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  const campaign = data.campaigns.find((c) => c.id === parsed.data.campaignId);
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
  running.add(session.user.id);
  lastCalls.set(session.user.id, Date.now());
  try {
    return Response.json(await discover(campaign));
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
    running.delete(session.user.id);
  }
}
