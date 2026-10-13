import { getSession } from "@/lib/server/session";
import { handleConnections } from "@/lib/server/connection-api";

async function handle(request: Request) {
  const session = await getSession();
  return handleConnections(request, session?.user.id || null);
}

export { handle as GET, handle as PUT, handle as DELETE, handle as POST };
