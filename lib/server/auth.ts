import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { database } from "./database";

export function createAuth(allowRegistration = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("BETTER_AUTH_SECRET doit contenir au moins 32 caractères.");
  return betterAuth({
    appName: "Sillage · 404NotFood",
    secret,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    database: database(),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowRegistration,
      minPasswordLength: 12,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true },
    plugins: [nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;
export function auth() {
  return (instance ??= createAuth());
}
export function authConfigured() {
  return !!process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32;
}
