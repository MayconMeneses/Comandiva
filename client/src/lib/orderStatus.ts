export type OrderFulfillmentType = "DELIVERY" | "PICKUP" | "DINE_IN";
export type OrderOperationalStatus = "PENDING" | "ACCEPTED" | "PREPARING" | "OUT_FOR_DELIVERY" | "READY_FOR_PICKUP" | "COMPLETED" | "CANCELLED";

export type NextOrderStatus = {
  status: Exclude<OrderOperationalStatus, "PENDING" | "CANCELLED">;
  label: string;
};

export function getNextOrderStatus(order: Pick<{ status: string; fulfillmentType: OrderFulfillmentType }, "status" | "fulfillmentType">): NextOrderStatus | null {
  if (order.status === "PENDING") return { status: "ACCEPTED", label: "Aceitar pedido" };
  if (order.status === "ACCEPTED") return { status: "PREPARING", label: "Iniciar preparo" };
  if (order.status === "PREPARING") {
    if (order.fulfillmentType === "DELIVERY") return { status: "OUT_FOR_DELIVERY", label: "Enviar para entrega" };
    if (order.fulfillmentType === "DINE_IN") return { status: "READY_FOR_PICKUP", label: "Pronto para servir" };
    return { status: "READY_FOR_PICKUP", label: "Pronto para retirada" };
  }
  if (order.status === "OUT_FOR_DELIVERY") return { status: "COMPLETED", label: "Concluir entrega" };
  if (order.status === "READY_FOR_PICKUP") return { status: "COMPLETED", label: order.fulfillmentType === "DINE_IN" ? "Marcar como servido" : "Concluir retirada" };
  return null;
}

// `expectedStatus` vai junto pra fechar a mesma corrida de dois dispositivos
// já fechada em RestaurantOrders.tsx/Kitchen.tsx (ver updateOrderStatus,
// server/routers/admin/orders.ts) — aqui também é possível ter /admin/pedidos
// aberto num aparelho enquanto outro membro da equipe mexe no mesmo pedido
// por /painel-pedidos ou /cozinha.
export type OrderStatusMutationInput = { orderId: number; status: NextOrderStatus["status"]; expectedStatus: OrderOperationalStatus };

export function advanceOrderStatus(order: Pick<{ id: number; status: string; fulfillmentType: OrderFulfillmentType }, "id" | "status" | "fulfillmentType">, mutate: (input: OrderStatusMutationInput) => void) {
  const next = getNextOrderStatus(order);
  if (next) mutate({ orderId: order.id, status: next.status, expectedStatus: order.status as OrderOperationalStatus });
}
