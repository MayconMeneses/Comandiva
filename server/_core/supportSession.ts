import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export type SupportSessionPayload = {
  supportSessionId: number;
  restaurantName: string;
  platformAdminEmail: string;
  expiresAt: number; // epoch ms — espelha support_sessions.expiresAt do saas-core
                      // exatamente; nunca estendido localmente (relógio único).
};

function getSecret() {
  return new TextEncoder().encode(ENV.supportSessionSecret);
}

export async function createSupportSessionToken(payload: SupportSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(getSecret());
}

export async function verifySupportSessionToken(cookieValue: string | undefined): Promise<SupportSessionPayload | null> {
  if (!cookieValue || !ENV.supportSessionSecret) return null;
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret(), { algorithms: ["HS256"] });
    const { supportSessionId, restaurantName, platformAdminEmail, expiresAt } = payload as Record<string, unknown>;
    if (typeof supportSessionId !== "number" || typeof restaurantName !== "string" || typeof platformAdminEmail !== "string" || typeof expiresAt !== "number") {
      return null;
    }
    return { supportSessionId, restaurantName, platformAdminEmail, expiresAt };
  } catch {
    return null;
  }
}
