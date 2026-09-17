import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export type PlatformSessionPayload = { adminId: number; email: string };

// 7 dias — sem "lembrar-me" nesta milestone, prazo fixo simples. MFA (2FA)
// vive num token à parte, de vida bem mais curta — ver PendingTotpPayload.
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

export type PendingTotpPayload = { purpose: "totp-setup" | "totp-verify"; adminId: number; email: string };

/** Token de curta duração usado só durante o handshake de 2FA, antes da sessão completa existir (login ainda não confirmou o código). */
export async function signPendingTotpToken(payload: PendingTotpPayload): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("10m").sign(getSecret());
}

export async function verifyPendingTotpToken(token: string): Promise<PendingTotpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { purpose, adminId, email } = payload as Record<string, unknown>;
    if ((purpose !== "totp-setup" && purpose !== "totp-verify") || typeof adminId !== "number" || typeof email !== "string") return null;
    return { purpose, adminId, email };
  } catch {
    return null;
  }
}

// 60 dias — pedido explícito do dono: 2FA não pode gerar fricção ao fazer
// manutenção pelo mesmo navegador/dispositivo. O código só é cobrado de novo
// se o cookie expirar, for apagado, ou o login vier de outro navegador —
// justamente o caso em que uma senha vazada sozinha não deveria bastar.
const TRUSTED_DEVICE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

export function getTrustedDeviceCookieMaxAgeMs(): number {
  return TRUSTED_DEVICE_MAX_AGE_MS;
}

/** Marca ESTE navegador como confiável pra este admin — dispensa o código de 2FA em próximos logins enquanto o cookie for válido. */
export async function createTrustedDeviceToken(adminId: number): Promise<string> {
  const expirationSeconds = Math.floor((Date.now() + TRUSTED_DEVICE_MAX_AGE_MS) / 1000);
  return new SignJWT({ adminId, purpose: "trusted-device" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(getSecret());
}

/** Só considera confiável se o token for válido E pertencer a ESTE admin — impede reaproveitar o cookie de outra conta no mesmo navegador. */
export async function isTrustedDeviceForAdmin(token: string | undefined, adminId: number): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { purpose, adminId: tokenAdminId } = payload as Record<string, unknown>;
    return purpose === "trusted-device" && tokenAdminId === adminId;
  } catch {
    return false;
  }
}
