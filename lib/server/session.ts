import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, authConfigured } from "./auth";

export async function getSession() {
  if (!authConfigured()) return null;
  return auth().api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/connexion");
  return session;
}

export function sameOrigin(request: Request) {
  const expected = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return request.headers.get("origin") === new URL(expected).origin;
}
