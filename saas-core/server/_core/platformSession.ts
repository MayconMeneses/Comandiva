import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export type PlatformSessionPayload = { adminId: number; email: string };

// 7 dias — sem MFA/"lembrar-me" nesta milestone, prazo fixo simples.
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getSecret() {
  return new TextEncoder().encode(ENV.platformJwtSecret);
}

export async function createPlatformSessionToken(adminId: number, email: string): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000);
  return new SignJWT({ adminId, email }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(getSecret());
}

export async function verifyPlatformSessionToken(token: string | undefined): Promise<PlatformSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { adminId, email } = payload as Record<string, unknown>;
    if (typeof adminId !== "number" || typeof email !== "string") return null;
    return { adminId, email };
  } catch {
    return null;
  }
}
