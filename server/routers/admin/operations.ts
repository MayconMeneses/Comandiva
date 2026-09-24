import { z } from "zod";
import { getAdminOrders, listPendingServiceRequests, listTablesWithOpenSessions } from "../../db";
import { requireAnyFeature, restaurantProcedure, router } from "../../_core/trpc";

/**
 * Orquestra 3 leituras que hoje são consultadas juntas, no mesmo instante, na
 * mesma tela (/painel-pedidos: pedidos + mapa de mesas + solicitações de
 * garçom pendentes) — cada uma continua existindo separada em
 * admin/orders.ts e admin/tables.ts pra quem usa só uma delas (ex.:
 * OrderManagement.tsx, TableConfigManager.tsx). Isto não duplica nenhuma
 * lógica, só agrupa 3 chamadas que já existiam numa única consulta/round-trip
 * quando as 3 são pedidas ao mesmo tempo pelo mesmo polling.
 *
 * Gate por plano (kitchen OU tables_qr): antes só o CLIENTE escondia esta
 * tela com base em `lockedFeatures.kitchen`/`lockedFeatures.tables_qr`
 * (RestaurantOrders.tsx/Kitchen.tsx checam "kitchen"; TablesAdmin.tsx checa
 * "tables_qr") — o procedure em si não tinha nenhum requireFeature, então
 * qualquer conta autenticada (mesmo plano Entrada, sem nenhuma das duas
 * features) conseguia chamar isto direto e ler pedidos/mesas/chamados de
 * garçom via API, contornando a UI. Achado numa varredura, 2026-09-24 — mesmo
 * princípio já documentado no projeto: recurso pago bloqueado de fato no
 * backend, nunca só escondido no frontend.
 */
export const adminOperationsRouter = router({
  operationalSnapshot: restaurantProcedure.use(requireAnyFeature(["kitchen", "tables_qr"])).input(z.object({ ordersLimit: z.number().int().min(1).max(100).default(80) }).optional()).query(async ({ input }) => {
    const [orders, tables, pendingServiceRequests] = await Promise.all([
      getAdminOrders({ limit: input?.ordersLimit ?? 80 }),
      listTablesWithOpenSessions(),
      listPendingServiceRequests(),
    ]);
    return { orders, tables, pendingServiceRequests };
  }),
});
