import { isNetworkError } from "@/lib/offlineRetry";
import type { AuthUser } from "@/lib/authSessionCache";

export type CachedAuthSession = { user: AuthUser; savedAt: number } | null | undefined;

/**
 * Decide entre a sessão ao vivo e o cache offline (Fase 0 do offline-first do
 * painel admin, ver plano em C:\Users\maico\.claude\plans\lovely-purring-dusk.md)
 * — separada de `useAuth.ts` (que fica em `_core/hooks/`, fora do escopo de
 * teste do vitest.config.ts) pra poder testar a decisão isoladamente, mesmo
 * padrão de `resolveOperationalSnapshotState` em `useOperationalSnapshot.ts`.
 *
 * `cached` tem 3 estados, não 2 — é o que evita a "piscada" de tela de login
 * antes da leitura do IndexedDB (assíncrona) responder: `undefined` = ainda
 * não checou o cache (só acontece nos primeiros instantes de um erro de
 * rede), `null` = checou e não tinha nada válido, objeto = sessão cacheada
 * válida. Enquanto `cached` for `undefined` numa queda de rede, o estado
 * continua "carregando" em vez de cair direto pra tela de login.
 */
export function resolveAuthState(
  query: { data: AuthUser | null | undefined; error: unknown; isLoading: boolean },
  cached: CachedAuthSession,
): { user: AuthUser | null; loading: boolean; isOffline: boolean; error: unknown } {
  const networkError = Boolean(query.error) && isNetworkError(query.error);
  if (networkError && cached === undefined) {
    return { user: null, loading: true, isOffline: false, error: null };
  }
  if (networkError && cached) {
    return { user: cached.user, loading: false, isOffline: true, error: null };
  }
  return { user: query.data ?? null, loading: query.isLoading, isOffline: false, error: networkError ? null : query.error };
}
