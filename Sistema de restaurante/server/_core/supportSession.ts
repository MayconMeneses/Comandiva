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

// ---- Revalidação no Painel Master -------------------------------------------
// O JWT acima só prova que a sessão FOI emitida e ainda não expirou. Sem esta
// consulta, encerrar a sessão no Painel Master (ou pausar o admin que a abriu)
// não derrubava nada no restaurante até o JWT expirar, e um cookie copiado
// continuava valendo mesmo depois do "Sair" (auditoria 2026-10-10).
// Cache curto pra não chamar o saas-core a cada requisição (o painel consulta a
// cada poucos segundos); FALHA FECHADA: sem resposta confiável, sem suporte.
export const SUPPORT_STATUS_CACHE_MS = 15_000;
const SUPPORT_STATUS_TIMEOUT_MS = 3_000;
const statusCache = new Map<number, { active: boolean; checkedAt: number }>();

export function clearSupportStatusCache() {
  statusCache.clear();
}

export async function isSupportSessionStillActive(supportSessionId: number, now = Date.now()): Promise<boolean> {
  const cached = statusCache.get(supportSessionId);
  if (cached && now - cached.checkedAt < SUPPORT_STATUS_CACHE_MS) return cached.active;

  let active = false;
  if (ENV.saasCoreUrl && ENV.saasCoreApiKey) {
    try {
      const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/support.checkSession`, {
        method: "POST",
        headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ supportSessionId }),
        signal: AbortSignal.timeout(SUPPORT_STATUS_TIMEOUT_MS),
      });
      if (response.ok) {
        const body = (await response.json()) as { result?: { data?: { active?: unknown } } };
        active = body.result?.data?.active === true;
      }
    } catch {
      active = false;
    }
  }

  if (statusCache.size > 200) {
    for (const [id, entry] of statusCache) if (now - entry.checkedAt > 10 * 60_000) statusCache.delete(id);
  }
  statusCache.set(supportSessionId, { active, checkedAt: now });
  return active;
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
