import { and, asc, desc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { orderChangeLogs, orderItemAddons, orderItems, orders, orderStatusHistory, payments, restaurantTables, tableSessions } from "../../drizzle/schema";
import { endOfMonthInRestaurantTimezone, startOfDayInRestaurantTimezone, startOfMonthInRestaurantTimezone } from "../../shared/orderDomain";
import { getDb, type DbOrTx } from "./client";

type OrderRow = typeof orders.$inferSelect;

/**
 * Anexa itens/complementos/histórico/logs/pagamento/mesa a uma LISTA de
 * pedidos já carregados, em no máximo 5 consultas no total (uma por tabela
 * relacionada, via inArray) — não uma consulta por pedido. Preserva
 * exatamente a ordem e o filtro que o chamador já aplicou em `orderRows`.
 */
async function attachOrderDetails(db: DbOrTx, orderRows: OrderRow[]) {
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
      // method/providerReference/metadata entraram pro fluxo de Pix
      // automático (createPixPayment reaproveita a cobrança salva em
      // metadata em vez de gerar outra) — sempre dentro de um pedido já
      // autorizado por publicCode+telefone (getOrderByTrackingCode) ou pelo
      // admin, nunca exposto por um endpoint que não confirme o dono antes.
      payment: payment
        ? { status: payment.status, method: payment.method, amountCents: payment.amountCents, paidAt: payment.paidAt, refundedAt: payment.refundedAt, refundReason: payment.refundReason, providerReference: payment.providerReference, metadata: payment.metadata }
        : null,
    };
  });
}

/**
 * `dbOrTx` opcional — permite chamar de dentro de uma transação já aberta
 * (ex.: admin/orders.ts::updateOrderStatus, que precisa ler o pedido já
 * atualizado ANTES do commit pra montar o payload do print job; numa
 * conexão separada, o isolamento do MySQL faria essa leitura não enxergar
 * o UPDATE ainda não commitado). Sem passar nada, comportamento igual a
 * sempre — abre a própria conexão.
 */
export async function getOrderWithDetails(orderId: number, dbOrTx?: DbOrTx) {
  const db = dbOrTx ?? (await getDb());
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return undefined;
  const [detailed] = await attachOrderDetails(db, [order]);
  return detailed;
}

/** Mesma forma de `getOrderWithDetails`, mas para uma lista inteira de pedidos já carregados — ver `attachOrderDetails`. Aceita `DbOrTx` (não só `Db`) pelo mesmo motivo: chamadores que precisam rodar dentro de uma transação já aberta (ver getSessionWithOrders, server/db/tableSessions.ts). */
export async function getOrdersWithDetailsBatch(db: DbOrTx, orderRows: OrderRow[]) {
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

export type RevenueTrendGranularity = "week" | "month" | "year";

const dayLabel = (ms: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", weekday: "short", day: "2-digit" }).format(ms);
const monthLabel = (ms: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", month: "short", year: "2-digit" }).format(ms);

/**
 * Série pro gráfico de movimento em Relatórios: "semana" = 7 barras diárias,
 * "mês" = 30 barras diárias, "ano" = 12 barras mensais — sempre terminando
 * agora, sempre no fuso do restaurante (mesmo raciocínio de
 * getDashboardMetrics/V-25). Junto, compara o total do período atual com o
 * total do período imediatamente anterior de mesma duração (semana passada,
 * mês passado, ano passado), pra responder "como foi o movimento comparado".
 * Só conta pedido COMPLETED — pedido cancelado/pendente não é faturamento.
 */
export async function getRevenueTrend(granularity: RevenueTrendGranularity, now: number = Date.now()) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const nowDate = new Date(now);

  const buckets = granularity === "year"
    ? Array.from({ length: 12 }, (_, i) => {
        const monthsAgo = 11 - i;
        const startAt = startOfMonthInRestaurantTimezone(monthsAgo, nowDate);
        return { label: monthLabel(startAt), startAt, endAt: endOfMonthInRestaurantTimezone(monthsAgo, nowDate) };
      })
    : Array.from({ length: granularity === "week" ? 7 : 30 }, (_, i) => {
        const daysAgo = (granularity === "week" ? 6 : 29) - i;
        const startAt = startOfDayInRestaurantTimezone(daysAgo, nowDate);
        return { label: dayLabel(startAt), startAt, endAt: startOfDayInRestaurantTimezone(daysAgo - 1, nowDate) - 1 };
      });

  const overallStart = buckets[0]!.startAt;
  const overallEnd = buckets[buckets.length - 1]!.endAt;
  const previousStart = overallStart - (overallEnd - overallStart + 1);
  const previousEnd = overallStart - 1;

  const [currentRows, previousRows] = await Promise.all([
    db.select({ createdAt: orders.createdAt, totalCents: orders.totalCents }).from(orders).where(and(eq(orders.status, "COMPLETED"), gte(orders.createdAt, overallStart), lte(orders.createdAt, overallEnd))),
    db.select({ totalCents: orders.totalCents }).from(orders).where(and(eq(orders.status, "COMPLETED"), gte(orders.createdAt, previousStart), lte(orders.createdAt, previousEnd))),
  ]);

  const series = buckets.map(bucket => {
    const bucketOrders = currentRows.filter(row => row.createdAt >= bucket.startAt && row.createdAt <= bucket.endAt);
    return { label: bucket.label, revenueCents: bucketOrders.reduce((sum, row) => sum + row.totalCents, 0), orderCount: bucketOrders.length };
  });

  const currentTotalCents = currentRows.reduce((sum, row) => sum + row.totalCents, 0);
  const previousTotalCents = previousRows.reduce((sum, row) => sum + row.totalCents, 0);
  const changePct = previousTotalCents > 0 ? ((currentTotalCents - previousTotalCents) / previousTotalCents) * 100 : null;

  return { granularity, series, currentTotalCents, previousTotalCents, changePct, currentOrderCount: currentRows.length, previousOrderCount: previousRows.length };
}

/**
 * Confirma o pagamento de um pedido a partir do webhook do Mercado Pago —
 * só marca o status financeiro (payments.status / orders.paymentStatus) como
 * PAID, nunca mexe no status operacional (orders.status): a equipe continua
 * aceitando/preparando o pedido normalmente, só passa a ver que já foi pago.
 * Idempotente — chamar de novo com o mesmo pagamento não causa efeito colateral.
 */
export async function markOrderPaymentPaidByPublicCode(publicCode: string, providerReference: string, dbOrTx?: DbOrTx) {
  const db = dbOrTx ?? (await getDb());
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
  if (!order) return { found: false as const };
  const now = Date.now();
  // Nunca resgata um pagamento já estornado/cancelado de volta pra PAID — o
  // Mercado Pago pode reentregar uma notificação antiga (reenvio manual pelo
  // painel dele, ou o at-least-once normal de webhook) bem depois de um
  // estorno já ter sido registrado por fora; sem esse filtro, isso desfazia
  // silenciosamente o estorno e deixava refundedAt/refundReason inconsistentes.
  await db.update(payments).set({ status: "PAID", providerReference, paidAt: now, updatedAt: now }).where(and(eq(payments.orderId, order.id), notInArray(payments.status, ["REFUNDED", "CANCELLED"])));
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
export async function markOrderPaymentFailedByPublicCode(publicCode: string, providerReference: string, status: "CANCELLED" | "REFUNDED" | "EXPIRED", dbOrTx?: DbOrTx) {
  const db = dbOrTx ?? (await getDb());
  if (!db) throw new Error("Banco de dados indisponível");
  const [order] = await db.select().from(orders).where(eq(orders.publicCode, publicCode)).limit(1);
  if (!order) return { found: false as const };
  const now = Date.now();
  const updates: Partial<typeof payments.$inferInsert> = { status, providerReference, updatedAt: now };
  if (status === "REFUNDED") updates.refundedAt = now;
  // Mesma proteção de markOrderPaymentPaidByPublicCode, na direção oposta:
  // uma notificação tardia de expiração/cancelamento (ex.: o Pix A venceu,
  // o cliente gerou um Pix B novo pro mesmo pedido e pagou, e só DEPOIS
  // chega a notificação de vencimento de A) nunca pode reverter um pagamento
  // já CONFIRMADO (PAID) ou já ESTORNADO (REFUNDED) — sem isso, o pedido
  // aparecia como não pago mesmo tendo sido pago de verdade.
  await db.update(payments).set(updates).where(and(eq(payments.orderId, order.id), notInArray(payments.status, ["PAID", "REFUNDED"])));
  return { found: true as const, orderId: order.id };
}

/**
 * Grava a cobrança Pix recém-criada no gateway — só o "copia e cola" e a
 * expiração vão pro banco (dentro de `metadata`, reaproveitando o mesmo
 * campo que já guarda `{changeForCents}` pra CASH); o QR visual é desenhado
 * no cliente a partir do copia-e-cola, não guardamos a imagem base64 do
 * gateway (evita inchar o banco com uma imagem que só serve por algumas
 * horas). `providerReference` é o id do pagamento no gateway — mesmo campo
 * que createCardPayment/webhook já usam pra cartão.
 */
export async function savePixChargeForOrder(orderId: number, charge: { providerReference: string; pixCopyPaste: string; expiresAt: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(payments).set({
    providerReference: charge.providerReference,
    metadata: JSON.stringify({ pixCopyPaste: charge.pixCopyPaste, pixExpiresAt: charge.expiresAt }),
    updatedAt: Date.now(),
  }).where(eq(payments.orderId, orderId));
}
