import { z } from "zod";
import { getAdminOrders, listPendingServiceRequests, listTablesWithOpenSessions } from "../../db";
import { restaurantProcedure, router } from "../../_core/trpc";

/**
 * Orquestra 3 leituras que hoje são consultadas juntas, no mesmo instante, na
 * mesma tela (/painel-pedidos: pedidos + mapa de mesas + solicitações de
 * garçom pendentes) — cada uma continua existindo separada em
 * admin/orders.ts e admin/tables.ts pra quem usa só uma delas (ex.:
 * OrderManagement.tsx, TableConfigManager.tsx). Isto não duplica nenhuma
 * lógica, só agrupa 3 chamadas que já existiam numa única consulta/round-trip
 * quando as 3 são pedidas ao mesmo tempo pelo mesmo polling.
 */
export const adminOperationsRouter = router({
  operationalSnapshot: restaurantProcedure.input(z.object({ ordersLimit: z.number().int().min(1).max(100).default(80) }).optional()).query(async ({ input }) => {
    const [orders, tables, pendingServiceRequests] = await Promise.all([
      getAdminOrders({ limit: input?.ordersLimit ?? 80 }),
      listTablesWithOpenSessions(),
      listPendingServiceRequests(),
    ]);
    return { orders, tables, pendingServiceRequests };
  }),
});
