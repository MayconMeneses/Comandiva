import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { del, get, set } from "idb-keyval";

export type AuthUser = NonNullable<inferRouterOutputs<AppRouter>["auth"]["me"]>;

/**
 * Fase 0 do offline-first do painel admin (ver plano em
 * C:\Users\maico\.claude\plans\lovely-purring-dusk.md): espelho local da última
 * sessão autenticada com sucesso, pra `useAuth.ts` não derrubar a equipe do
 * painel (spinner infinito ou tela de login) só porque um reload aconteceu
 * durante uma queda de internet, mesmo com cookie de sessão válido no aparelho.
 *
 * 24h, não as 2h do `operationalSnapshotCache.ts`: aqui é identidade/permissão,
 * não dado operacional que fica perigoso de usar velho — o risco de segurança
 * de confiar numa sessão cacheada por tempo demais é bem menor que o risco de
 * derrubar a equipe do painel no meio de uma pane longa. Depois desse teto,
 * força login real de novo (o servidor sempre revalida em paralelo assim que
 * a rede volta).
 */
export const AUTH_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const KEY = "mm-auth-session";

type StoredSession = { user: AuthUser; savedAt: number };

// idb-keyval pode falhar (modo privado antigo, quota) — mesmo padrão de
// degradação segura já usado em operationalSnapshotCache.ts/pendingOrderQueue.ts:
// sem cache offline, o resto do app continua funcionando normalmente online.
export async function saveAuthSession(user: AuthUser): Promise<void> {
  // Sessão de Modo Suporte é um handoff de uso único, de duração curta — nunca
  // pode sobreviver offline além da janela real dela no servidor. Só sessão
  // real de funcionário/admin (cookie normal) é elegível a cache offline.
  if ("viaSupportSession" in user && user.viaSupportSession) return;
  try {
    await set(KEY, { user, savedAt: Date.now() } satisfies StoredSession);
  } catch {
    // sem persistência — a tela continua funcionando online normalmente.
  }
}

export async function loadAuthSession(now: number = Date.now()): Promise<StoredSession | null> {
  try {
    const stored = await get<StoredSession>(KEY);
    if (!stored) return null;
    if (now - stored.savedAt > AUTH_SESSION_MAX_AGE_MS) return null;
    return stored;
  } catch {
    return null;
  }
}

// Chamado no logout — a sessão cacheada não pode sobreviver troca de usuário
// no mesmo tablet (mesmo racional de clearOperationalSnapshot()).
export async function clearAuthSession(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // nada a fazer — pior caso é um cache velho que o TTL já cobre.
  }
}
