import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

export type PlatformSessionPayload = { adminId: number; email: string; iat: number };

// 12 horas ABSOLUTAS (antes: 7 dias). O Painel Master controla cobrança e
// entra no deployment de qualquer cliente (Modo Suporte) — é o alvo de maior
// valor do sistema, então a sessão curta limita o estrago de um cookie
// roubado. Não renova sozinha: passou de 12h, entra de novo. Além do prazo, a
// sessão também pode ser derrubada antes pelo servidor (sessionsValidAfter,
// ver isSessionRevoked) — troca de senha, 2FA, conta pausada etc.
const SESSION_MAX_AGE = "12h";

/** Instante atual em SEGUNDOS unix — mesma unidade do `iat` do JWT e da coluna sessionsValidAfter. */
export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function getSecret() {
  return new TextEncoder().encode(ENV.platformJwtSecret);
}

export async function createPlatformSessionToken(adminId: number, email: string): Promise<string> {
  // setIssuedAt grava o `iat` (em segundos) — é ele que o servidor compara com
  // sessionsValidAfter pra saber se a sessão foi revogada.
  return new SignJWT({ adminId, email }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(SESSION_MAX_AGE).sign(getSecret());
}

/**
 * Token de sessão NUNCA tem o claim `purpose`; tokens de outros usos (ex.: o
 * "pendente de 2FA" abaixo) têm. Recusar qualquer token com `purpose` aqui
 * impede que alguém pegue o token pendente (que o navegador recebe depois de
 * acertar só a senha) e o coloque no cookie de sessão pra pular o 2FA.
 */
export async function verifyPlatformSessionToken(token: string | undefined): Promise<PlatformSessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { adminId, email, iat, purpose } = payload as Record<string, unknown>;
    if (purpose !== undefined) return null;
    // Sem `iat` não dá pra checar revogação — tokens antigos (7 dias, emitidos antes desta versão) caem aqui e exigem novo login.
    if (typeof adminId !== "number" || typeof email !== "string" || typeof iat !== "number") return null;
    return { adminId, email, iat };
  } catch {
    return null;
  }
}

/**
 * A sessão foi revogada se foi emitida ANTES de sessionsValidAfter (ambos em
 * segundos). Comparação estritamente menor de propósito: um login feito no
 * mesmo segundo da troca de senha/2FA não pode ser recusado.
 */
export function isSessionRevoked(sessionIssuedAt: number, sessionsValidAfter: number | null | undefined): boolean {
  return sessionsValidAfter != null && sessionIssuedAt < sessionsValidAfter;
}

export type PendingTotpPayload = { purpose: "totp-verify"; adminId: number; email: string; iat: number };

/** Token de 5 minutos, usado só entre "senha correta" e "código de 2FA correto" — não vale como sessão (tem `purpose`). */
export async function signPendingTotpToken(adminId: number, email: string): Promise<string> {
  return new SignJWT({ purpose: "totp-verify", adminId, email }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("5m").sign(getSecret());
}

export async function verifyPendingTotpToken(token: string): Promise<PendingTotpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const { purpose, adminId, email, iat } = payload as Record<string, unknown>;
    if (purpose !== "totp-verify" || typeof adminId !== "number" || typeof email !== "string" || typeof iat !== "number") return null;
    return { purpose, adminId, email, iat };
  } catch {
    return null;
  }
}
