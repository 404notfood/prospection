import { redirect } from "next/navigation";
import { authConfigured } from "@/lib/server/auth";
export const dynamic = "force-dynamic";
export default function Home() {
  redirect(authConfigured() ? "/app" : "/demo");
}
