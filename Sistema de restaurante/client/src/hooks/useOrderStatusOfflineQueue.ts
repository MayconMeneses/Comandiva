import type { AppRouter } from "../../../server/routers";
import type { inferRouterInputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import { offlineResilienceMutationOptions } from "@/lib/offlineRetry";
import { clearPendingOrder, PENDING_ORDER_SCHEMA_VERSION, persistPendingOrder } from "@/lib/pendingOrderQueue";

type UpdateOrderStatusInput = inferRouterInputs<AppRouter>["admin"]["updateOrderStatus"];

/**
 * Fiação de offline (retry + fila de recuperação) pra `admin.updateOrderStatus`
 * — antes copiada idêntica em 4 lugares (OrderCard/RestaurantOrders.tsx,
 * QueueCard/Kitchen.tsx, OrderStatusActions/OrderManagement.tsx,
 * OrderActions/OrdersTable.tsx), cada tela com sua própria cópia de
 * `settings.useQuery()`/`onMutate`/`onSettled`. Consolidado aqui pelo mesmo
 * motivo de `useOperationalSnapshot` (Fase A): um ajuste nessa lógica não
 * pode depender de lembrar de repetir em 4 lugares. Só cobre a fiação de
 * offline — cada tela continua dona da sua própria lógica de qual é a
 * "próxima etapa" e do texto do toast em `onSuccess`/`onError`, que
 * permanecem diferentes de propósito entre as 4 telas.
 */
export function useOrderStatusOfflineQueue(orderId: number) {
  const settings = trpc.catalog.settings.useQuery();
  const offlineResilienceEnabled = Boolean(settings.data?.offlineResilienceEnabled);
  return {
    offlineResilienceEnabled,
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onMutate: (variables: UpdateOrderStatusInput) => {
      if (!offlineResilienceEnabled) return;
      persistPendingOrder({ type: "admin.updateOrderStatus", orderId, payload: variables, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
    },
    onSettled: () => {
      if (offlineResilienceEnabled) clearPendingOrder({ type: "admin.updateOrderStatus", orderId });
    },
  };
}
