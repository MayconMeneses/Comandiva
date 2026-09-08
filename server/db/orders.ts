import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { orderChangeLogs, orderItemAddons, orderItems, orders, orderStatusHistory, payments, restaurantTables, tableSessions } from "../../drizzle/schema";
import { getDb } from "./client";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type OrderRow = typeof orders.$inferSelect;

/**
 * Anexa itens/complementos/histórico/logs/pagamento/mesa a uma LISTA de
 * pedidos já carregados, em no máximo 5 consultas no total (uma por tabela
 * relacionada, via inArray) — não uma consulta por pedido. Preserva
 * exatamente a ordem e o filtro que o chamador já aplicou em `orderRows`.
 */
async function attachOrderDetails(db: Db, orderRows: OrderRow[]) {
  if (!orderRows.length) return [];
  const orderIds = orderRows.map(order => order.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
  const itemIds = items.map(item => item.id);
  const addons = itemIds.length
    ? await db.select().from(orderItemAddons).where(inArray(orderItemAddons.orderItemId, itemIds))
    : [];
  const history = await db
    .select()
    .from(orderStatusHistory)
    .where(inArray(orderStatusHistory.orderId, orderIds))
    .orderBy(asc(orderStatusHistory.createdAt));
  const changeLogs = await db
    .select()
    .from(orderChangeLogs)
    .where(inArray(orderChangeLogs.orderId, orderIds))
    .orderBy(desc(orderChangeLogs.createdAt));
  const paymentRows = await db.select().from(payments).where(inArray(payments.orderId, orderIds));
  const tableSessionIds = [...new Set(orderRows.map(order => order.tableSessionId).filter((id): id is number => id != null))];
  const tableLabelRows = tableSessionIds.length
    ? await db
        .select({ sessionId: tableSessions.id, label: restaurantTables.label })
        .from(tableSessions)
        .innerJoin(restaurantTables, eq(restaurantTables.id, tableSessions.tableId))
        .where(inArray(tableSessions.id, tableSessionIds))
    : [];
  const tableLabelBySessionId = new Map(tableLabelRows.map(row => [row.sessionId, row.label]));

  return orderRows.map(order => {
    const orderItemsForOrder = items.filter(item => item.orderId === order.id);
    const payment = paymentRows.find(row => row.orderId === order.id);
    return {
      ...order,
      tableLabel: order.tableSessionId ? (tableLabelBySessionId.get(order.tableSessionId) ?? null) : null,
      items: orderItemsForOrder.map(item => ({ ...item, addons: addons.filter(addon => addon.orderItemId === item.id) })),
      history: history.filter(row => row.orderId === order.id),
      changeLogs: changeLogs.filter(row => row.orderId === order.id),
      // Estado financeiro completo (payments.status inclui CANCELLED/REFUNDED,
      // que orders.paymentStatus — só PENDING/PAID — nunca representou).
      payment: payment
        ? { status: payment.status, amountCents: payment.amountCents, paidAt: payment.paidAt, refundedAt: payment.refundedAt, refundReason: payment.refundReason }
        : null,
    };
  });
}

export async function getOrderWithDetails(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return undefined;
  const [detailed] = await attachOrderDetails(db, [order]);
  return detailed;
}

/** Mesma forma de `getOrderWithDetails`, mas para uma lista inteira de pedidos já carregados — ver `attachOrderDetails`. */
export async function getOrdersWithDetailsBatch(db: Db, orderRows: OrderRow[]) {
  return attachOrderDetails(db, orderRows);
}

export async function getOrderByTrackingCode(publicCode: string, phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.publicCode, publicCode), eq(orders.customerPhone, phone)))
    .limit(1);
  return order ? getOrderWithDetails(order.id) : undefined;
}

export async function getLatestActiveOrderByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerPhone, phone))
    .orderBy(desc(orders.createdAt))
    .limit(12);
  const activeOrder = recentOrders.find(order => order.status !== "COMPLETED" && order.status !== "CANCELLED");
  return activeOrder ? getOrderWithDetails(activeOrder.id) : undefined;
}

export async function getActiveOrdersByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const recentOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.customerPhone, phone))
    .orderBy(desc(orders.createdAt))
    .limit(12);
  const activeOrders = recentOrders.filter(order => order.status !== "COMPLETED" && order.status !== "CANCELLED");
  return getOrdersWithDetailsBatch(db, activeOrders);
}

export async function getAdminOrders(filters: { status?: string; startAt?: number; endAt?: number; limit: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const conditions = [];
  if (filters.status) conditions.push(eq(orders.status, filters.status as typeof orders.status.enumValues[number]));
  if (filters.startAt) conditions.push(gte(orders.createdAt, filters.startAt));
  if (filters.endAt) conditions.push(lte(orders.createdAt, filters.endAt));
  const rows = await db
    .select()
    .from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(filters.limit);
  return getOrdersWithDetailsBatch(db, rows.filter(order => !order.archivedAt));
}

export async function getDashboardMetrics(startAt: number, endAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [metrics] = await db
    .select({
      count: sql<number>`count(*)`,
      revenueCents: sql<number>`coalesce(sum(case when ${orders.status} = 'COMPLETED' then ${orders.totalCents} else 0 end), 0)`,
      averageTicketCents: sql<number>`coalesce(avg(case when ${orders.status} = 'COMPLETED' then ${orders.totalCents} end), 0)`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, startAt), lte(orders.createdAt, endAt)));
  const statusRows = await db
    .select({ status: orders.status, count: sql<number>`count(*)` })
    .from(orders)
    .where(and(gte(orders.createdAt, startAt), lte(orders.createdAt, endAt)))
    .groupBy(orders.status);
  return { metrics, byStatus: statusRows };
}

/**
 * Confirma o pagamento de um pedido a partir do webhook do Mercado Pago —
 * só marca o status financeiro (payments.status / orders.paymentStatus) como
 * PAID, nunca mexe no status operacional (orders.status): a equipe continua
 * aceitando/preparando o pedido normalmente, só passa a ver que já foi pago.
 * Idempotente — chamar de novo com o mesmo pagamento não causa efeito colateral.
 */
export async function markOrderPaymentPaidByPublicCode(publicCode: string, providerReference: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
  if (!order) return { found: false as const };
  const now = Date.now();
  await db.update(payments).set({ status: "PAID", providerReference, paidAt: now, updatedAt: now }).where(eq(payments.orderId, order.id));
  if (order.paymentStatus !== "PAID") {
    await db.update(orders).set({ paymentStatus: "PAID", updatedAt: now }).where(eq(orders.id, order.id));
  }
  return { found: true as const, orderId: order.id };
}

// Espelha markOrderPaymentPaidByPublicCode, mas pro caso de o Mercado Pago
// reportar recusa/cancelamento/estorno via webhook (não só aprovação). Sem
// isso, um pagamento recusado no lado do MP deixava o pedido silenciosamente
// PENDING pra sempre, sem sinalizar a recusa pra equipe. orders.paymentStatus
// nunca muda aqui — o enum dele é só PENDING/PAID (nunca representou "falhou"
// nem "estornado"); quem carrega esse detalhe é sempre payments.status, já
// exposto em getOrderWithDetails/attachOrderDetails.
export async function markOrderPaymentFailedByPublicCode(publicCode: string, providerReference: string, status: "CANCELLED" | "REFUNDED") {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
  if (!order) return { found: false as const };
  const now = Date.now();
  const updates: Partial<typeof payments.$inferInsert> = { status, providerReference, updatedAt: now };
  if (status === "REFUNDED") updates.refundedAt = now;
  await db.update(payments).set(updates).where(eq(payments.orderId, order.id));
  return { found: true as const, orderId: order.id };
}
