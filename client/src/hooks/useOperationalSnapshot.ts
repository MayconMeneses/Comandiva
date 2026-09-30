import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { isNetworkError } from "@/lib/offlineRetry";
import { loadOperationalSnapshot, saveOperationalSnapshot, type OperationalSnapshot } from "@/lib/operationalSnapshotCache";

type CachedSnapshot = { snapshot: OperationalSnapshot; savedAt: number } | null;

/**
 * Decide entre o dado ao vivo e o cache offline — separada do hook em si
 * (que precisa de um `trpc.Provider` de verdade pra renderizar, sem padrão
 * de mock ainda neste projeto) pra poder testar a decisão isoladamente,
 * mesmo raciocínio de `isNetworkError`/`shouldRetryOrderMutation` em
 * offlineRetry.ts: a lógica pura é testável, a fiação do React Query não
 * precisa ser.
 *
 * `isOffline` só fica `true` quando o erro é de rede de verdade — um erro de
 * negócio real (licença, validação) continua caindo em `error`, pra tela
 * mostrar a mensagem de erro de sempre em vez de fingir que está offline.
 */
export function resolveOperationalSnapshotState<TError>(
  query: { data: OperationalSnapshot | undefined; error: TError | null | undefined; isLoading: boolean; isFetching: boolean; refetch: () => void },
  cached: CachedSnapshot,
): { data: OperationalSnapshot | undefined; isLoading: boolean; isOffline: boolean; cachedAt: number | undefined; error: TError | null | undefined; isFetching: boolean; refetch: () => void } {
  const networkError = Boolean(query.error) && isNetworkError(query.error);
  // `refetch`/`isFetching` sempre vêm da query real, mesmo offline — pedir
  // pra tentar de novo (ex.: botão "Atualizar") continua fazendo sentido
  // nesse estado, só vai falhar de novo até a conexão voltar.
  if (networkError) {
    return { data: cached?.snapshot, isLoading: false, isOffline: true, cachedAt: cached?.savedAt, error: undefined, isFetching: query.isFetching, refetch: query.refetch };
  }
  return { data: query.data, isLoading: query.isLoading, isOffline: false, cachedAt: undefined, error: query.error, isFetching: query.isFetching, refetch: query.refetch };
}

/**
 * Substitui a chamada direta a `trpc.admin.operationalSnapshot.useQuery(...)`
 * (antes espalhada em Kitchen.tsx, RestaurantOrders.tsx e TableMapManager.tsx,
 * cada uma com sua própria cópia) — único lugar que precisa saber de cache
 * offline (Fase A, ver plano em C:\Users\maico\.claude\plans\curried-sprouting-wirth.md).
 */
export function useOperationalSnapshot(options: { enabled: boolean; ordersLimit?: number }) {
  const query = trpc.admin.operationalSnapshot.useQuery(options.ordersLimit !== undefined ? { ordersLimit: options.ordersLimit } : undefined, {
    enabled: options.enabled,
    refetchInterval: 10000,
  });

  // Write-through: salva toda busca bem-sucedida, sem esperar ficar offline
  // pra descobrir que não tinha nada salvo ainda.
  useEffect(() => {
    if (query.data) void saveOperationalSnapshot(query.data);
  }, [query.data]);

  const networkError = Boolean(query.error) && isNetworkError(query.error);
  const [cached, setCached] = useState<CachedSnapshot>(null);

  // Leitura do IndexedDB é assíncrona por natureza — só dispara quando de
  // fato precisa (erro de rede), não em toda renderização.
  useEffect(() => {
    if (!networkError) return;
    let cancelled = false;
    void loadOperationalSnapshot().then(result => {
      if (!cancelled) setCached(result);
    });
    return () => {
      cancelled = true;
    };
  }, [networkError]);

  return resolveOperationalSnapshotState(query, cached);
}
