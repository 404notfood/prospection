import { toNextJsHandler } from "better-auth/next-js";
import { auth, authConfigured } from "@/lib/server/auth";

function unavailable() {
  return Response.json({ message: "L’accès privé n’est pas encore configuré." }, { status: 503 });
}
export async function GET(request: Request) {
  return authConfigured() ? toNextJsHandler(auth()).GET(request) : unavailable();
}
export async function POST(request: Request) {
  return authConfigured() ? toNextJsHandler(auth()).POST(request) : unavailable();
}
