import { useEffect, useState } from "react";
import { PENDING_ORDER_WINDOW_MS } from "@/lib/pendingOrderQueue";

/**
 * Enquanto uma mutation de criar pedido/rodada está pausada/retryando (ver
 * isRetryingOffline, client/src/lib/offlineRetry.ts) há tempo demais — mesmo
 * threshold PENDING_ORDER_WINDOW_MS da Fase 3 completa, mesmo risco (priceOrder
 * recalcula preço/disponibilidade do zero sem congelamento de cotação) — vira
 * `true`, pra tela trocar o aviso e orientar recarregar. Mutations do React
 * Query 5.90.2 não suportam cancelamento (confirmado lendo query-core/src/
 * mutation.ts — sem abort/signal), então isso é só um aviso; não tenta matar
 * a mutation.
 *
 * `startedAt` é responsabilidade de quem chama (ref setada no onMutate, com o
 * MESMO Date.now() já usado em persistPendingOrder) — deliberadamente não lê
 * a fila persistida aqui: readValidPendingOrders() remove entradas expiradas
 * como efeito colateral, e chamar isso periodicamente enquanto a mutation
 * ainda está ativa apagaria a entrada que um F5 precisaria pra reusar o
 * mesmo operationId.
 */
export function useStaleRetryWarning(active: boolean, startedAt: number | null): boolean {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!active || startedAt === null) {
      setIsStale(false);
      return;
    }
    const check = () => setIsStale(Date.now() - startedAt > PENDING_ORDER_WINDOW_MS);
    check();
    const interval = setInterval(check, 15_000);
    return () => clearInterval(interval);
  }, [active, startedAt]);

  return isStale;
}
