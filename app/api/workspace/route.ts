import { z } from "zod";
import { workspaceSchema } from "@/lib/domain/schema";
import { validateWorkspace } from "@/lib/domain/prospects";
import { getSession, sameOrigin } from "@/lib/server/session";
import { readWorkspace, saveWorkspace } from "@/lib/server/repository";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  return Response.json(await readWorkspace(session.user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 8_000_000)
    return Response.json({ error: "Sauvegarde trop volumineuse." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "JSON invalide." }, { status: 400 });
  }
  const parsed = z
    .object({ data: workspaceSchema, revision: z.number().int().min(0) })
    .safeParse(json);
  if (!parsed.success)
    return Response.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const error = validateWorkspace(parsed.data.data);
  if (error) return Response.json({ error }, { status: 422 });
  const current = await readWorkspace(session.user.id);
  if (current.revision !== parsed.data.revision)
    return Response.json(
      {
        error: "Les données ont changé dans un autre onglet. Rechargez la page avant de réessayer.",
      },
      { status: 409 },
    );
  const revision = await saveWorkspace(session.user.id, parsed.data.data, parsed.data.revision);
  if (revision === undefined)
    return Response.json(
      { error: "Une autre sauvegarde a eu lieu. Rechargez la page." },
      { status: 409 },
    );
  return Response.json({ revision });
}
