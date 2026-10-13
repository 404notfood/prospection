import { z } from "zod";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace } from "@/lib/server/repository";
import { listJobs, enqueueJob, controlJob, workerOnline } from "@/lib/server/jobs";
import { aiUsage } from "@/lib/server/ai-usage";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const [jobs, online, usage] = await Promise.all([
    listJobs(session.user.id),
    workerOnline(),
    aiUsage(session.user.id),
  ]);
  return Response.json({ jobs, online, usage }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({ campaignId: z.string().min(1), mode: z.enum(["discover", "process"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Traitement invalide." }, { status: 422 });
  const { data } = await readWorkspace(session.user.id);
  const campaign = data.campaigns.find((c) => c.id === parsed.data.campaignId);
  if (!campaign || campaign.state !== "active")
    return Response.json(
      { error: "Activez la campagne avant de lancer son traitement." },
      { status: 422 },
    );
  if (parsed.data.mode === "discover" && !data.settings.discoveryEnabled)
    return Response.json({ error: "Activez la découverte dans les paramètres." }, { status: 422 });
  return Response.json(await enqueueJob(session.user.id, campaign, parsed.data.mode), {
    status: 202,
  });
}
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const parsed = z
    .object({ id: z.string().min(1), action: z.enum(["pause", "resume", "cancel"]) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Action invalide." }, { status: 422 });
  try {
    return Response.json(await controlJob(session.user.id, parsed.data.id, parsed.data.action));
  } catch {
    return Response.json(
      { error: "Action indisponible pour ce traitement. Actualisez son état." },
      { status: 409 },
    );
  }
}
