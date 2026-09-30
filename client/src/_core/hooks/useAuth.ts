import { trpc } from "@/lib/trpc";
import { clearOperationalSnapshot } from "@/lib/operationalSnapshotCache";
import { clearAuthSession, loadAuthSession, saveAuthSession } from "@/lib/authSessionCache";
import { isNetworkError } from "@/lib/offlineRetry";
import { resolveAuthState, type CachedAuthSession } from "@/lib/resolveAuthState";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // The local authentication form owns sign-in. This hook only observes the
  // current session and may redirect to an explicitly configured local route.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear the Preview auto-login token mirrored into sessionStorage, so
      // header-based sessions (Safari ITP / WebView) are logged out too. The
      // backend cookie is cleared by the logout mutation.
      try {
        sessionStorage.removeItem("local-cookie");
      } catch {}
      // Cache offline (Fase A, ver plano em
      // C:\Users\maico\.claude\plans\curried-sprouting-wirth.md) tem
      // nome/telefone de cliente em alguns pedidos — não pode sobreviver
      // troca de usuário no mesmo tablet. Mesmo racional pra sessão
      // cacheada (Fase 0, useAuth) — clearAuthSession() abaixo.
      void clearOperationalSnapshot();
      void clearAuthSession();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  // Write-through: salva toda busca bem-sucedida, sem esperar ficar offline
  // pra descobrir que não tinha nada salvo ainda (mesmo padrão de
  // useOperationalSnapshot.ts).
  useEffect(() => {
    if (meQuery.data) void saveAuthSession(meQuery.data);
  }, [meQuery.data]);

  const networkError = Boolean(meQuery.error) && isNetworkError(meQuery.error);
  const [cachedSession, setCachedSession] = useState<CachedAuthSession>(undefined);

  // Leitura do IndexedDB é assíncrona por natureza — só dispara quando de
  // fato precisa (erro de rede), não em toda renderização. `cachedSession`
  // começa `undefined` ("ainda não checou"), exatamente o estado que
  // `resolveAuthState` trata como "continua carregando" — é isso que evita a
  // piscada de tela de login antes dessa leitura responder.
  useEffect(() => {
    if (!networkError) return;
    let cancelled = false;
    void loadAuthSession().then(result => {
      if (!cancelled) setCachedSession(result);
    });
    return () => {
      cancelled = true;
    };
  }, [networkError]);

  // Sem useMemo aqui de propósito (mesmo padrão de useOperationalSnapshot.ts):
  // `meQuery` é um objeto novo a cada render (React Query), memoizar em cima
  // dele não economiza nada — e a função em si é barata.
  const resolved = resolveAuthState(meQuery, cachedSession);

  const state = useMemo(() => ({
    user: resolved.user,
    loading: resolved.loading || logoutMutation.isPending,
    error: resolved.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(resolved.user),
    isOffline: resolved.isOffline,
  }), [resolved, logoutMutation.error, logoutMutation.isPending]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (state.loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
