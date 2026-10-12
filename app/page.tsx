import type { Metadata } from "next";
import { LoginPage } from "@/components/auth/login-page";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connexion" };
export default LoginPage;
