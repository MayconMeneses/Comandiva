import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { orders, restaurantTables, tableBillPayments, tableReservations, tableServiceRequests, tableSessions } from "../../drizzle/schema";
import { getDb } from "./client";
import { getOrdersWithDetailsBatch } from "./orders";
import { listTables } from "./tables";

const OPEN_SESSION_STATUSES = ["OPEN", "AWAITING_PAYMENT"] as const;

// ---- Comandas (table_sessions) ----

export async function findOpenSessionForTable(tableId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [session] = await db
    .select()
    .from(tableSessions)
    .where(and(eq(tableSessions.tableId, tableId), inArray(tableSessions.status, OPEN_SESSION_STATUSES)))
    .orderBy(desc(tableSessions.openedAt))
    .limit(1);
  return session;
}

/** Idempotente: retorna a comanda já aberta da mesa, ou abre uma nova (e marca a mesa OCCUPIED). */
export async function getOrOpenSessionForTable(tableId: number, partySize?: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const existing = await findOpenSessionForTable(tableId);
  if (existing) return existing;
  const now = Date.now();
  // Abrir a comanda + ocupar a mesa andam juntos numa transação — antes
  // eram 2 escritas soltas, então uma queda entre elas podia deixar uma
  // comanda aberta sem a mesa marcada OCCUPIED (ou vice-versa).
  return db.transaction(async tx => {
    const result = await tx.insert(tableSessions).values({ tableId, status: "OPEN", partySize: partySize ?? null, openedAt: now, createdAt: now, updatedAt: now });
    const sessionId = Number(result[0].insertId);
    await tx.update(restaurantTables).set({ status: "OCCUPIED", updatedAt: now }).where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.status, "FREE")));
    const [session] = await tx.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
    return session!;
  });
}

export async function getSessionWithOrders(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!session) return undefined;
  const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, session.tableId)).limit(1);
  const orderRows = await db.select().from(orders).where(eq(orders.tableSessionId, sessionId)).orderBy(asc(orders.createdAt));
  const detailed = await getOrdersWithDetailsBatch(db, orderRows);
  const billPayments = await db.select().from(tableBillPayments).where(eq(tableBillPayments.tableSessionId, sessionId)).orderBy(asc(tableBillPayments.createdAt));
  const activeOrders = detailed.filter(order => order.status !== "CANCELLED");
  const totalCents = activeOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const paidCents = billPayments.filter(payment => payment.status === "PAID").reduce((sum, payment) => sum + payment.amountCents, 0);
  const [pendingWaiterRequest] = await db.select().from(tableServiceRequests).where(and(eq(tableServiceRequests.tableSessionId, sessionId), eq(tableServiceRequests.status, "PENDING"))).limit(1);
  return { session, table, orders: detailed, billPayments, totalCents, paidCents, balanceDueCents: totalCents - paidCents, waiterRequested: Boolean(pendingWaiterRequest) };
}

/** Mapa de mesas do admin: cada mesa ativa + resumo da comanda aberta (se houver) + sinais de alerta, numa única consulta por lista. */
export async function listTablesWithOpenSessions() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const tables = await listTables();
  const tableIds = tables.map(table => table.id);
  const openSessions = tableIds.length
    ? await db.select().from(tableSessions).where(and(inArray(tableSessions.tableId, tableIds), inArray(tableSessions.status, OPEN_SESSION_STATUSES)))
    : [];
  const sessionIds = openSessions.map(session => session.id);
  const activeOrders = sessionIds.length ? await db.select().from(orders).where(inArray(orders.tableSessionId, sessionIds)) : [];
  const pendingWaiterRequests = sessionIds.length
    ? await db.select().from(tableServiceRequests).where(and(inArray(tableServiceRequests.tableSessionId, sessionIds), eq(tableServiceRequests.status, "PENDING")))
    : [];
  const now = Date.now();
  const upcomingReservations = tableIds.length
    ? await db.select().from(tableReservations).where(and(inArray(tableReservations.tableId, tableIds), inArray(tableReservations.status, ["REQUESTED", "CONFIRMED"]), gt(tableReservations.reservedFor, now)))
    : [];

  return tables.map(table => {
    const nextReservation = upcomingReservations.filter(reservation => reservation.tableId === table.id).sort((a, b) => a.reservedFor - b.reservedFor)[0];
    const minutesToReservation = nextReservation ? Math.round((nextReservation.reservedFor - now) / 60000) : null;
    const session = openSessions.find(candidate => candidate.tableId === table.id);
    if (!session) return { table, session: null, totalCents: 0, openOrdersCount: 0, oldestActiveOrderAt: null, hasPendingOrder: false, waiterRequested: false, minutesToReservation };
    const sessionOrders = activeOrders.filter(order => order.tableSessionId === session.id && order.status !== "CANCELLED");
    const activeUnfinished = sessionOrders.filter(order => order.status !== "COMPLETED");
    return {
      table,
      session,
      totalCents: sessionOrders.reduce((sum, order) => sum + order.totalCents, 0),
      openOrdersCount: activeUnfinished.length,
      oldestActiveOrderAt: activeUnfinished.length ? Math.min(...activeUnfinished.map(order => order.createdAt)) : null,
      hasPendingOrder: sessionOrders.some(order => order.status === "PENDING"),
      waiterRequested: pendingWaiterRequests.some(request => request.tableSessionId === session.id),
      minutesToReservation,
    };
  });
}

export async function requestSessionBill(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  await db.update(tableSessions).set({ status: "AWAITING_PAYMENT", billRequestedAt: now, updatedAt: now }).where(eq(tableSessions.id, sessionId));
}

export async function recordBillPayment(sessionId: number, input: { method: "PIX" | "CASH" | "CARD_ON_DELIVERY" | "CARD_ONLINE"; amountCents: number; payerLabel?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  await db.insert(tableBillPayments).values({
    tableSessionId: sessionId,
    method: input.method,
    amountCents: input.amountCents,
    payerLabel: input.payerLabel ?? null,
    status: "PAID",
    paidAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Fecha a comanda: exige saldo zerado (todas as parcelas da conta já
 * registradas cobrem o total), marca os pedidos da sessão como pagos (pro
 * relatório financeiro bater) e libera a mesa. Lança erro se ainda faltar
 * pagamento — fechar com saldo em aberto é decisão exclusiva de quem cancela
 * a comanda (`cancelTableSession`), não do fechamento normal.
 */
export async function closeTableSession(sessionId: number, closedByUserId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const detail = await getSessionWithOrders(sessionId);
  if (!detail) throw new Error("Comanda não encontrada.");
  if (detail.balanceDueCents > 0) throw new Error("A conta ainda não foi totalmente paga.");
  const now = Date.now();
  const orderIds = detail.orders.filter(order => order.status !== "CANCELLED").map(order => order.id);
  // As 3 escritas numa transação só — sem isso, um travamento no meio podia
  // fechar a comanda mas deixar os pedidos dela como "não pago" pro
  // relatório financeiro (ou liberar/travar a mesa incoerente com o status
  // real da comanda).
  await db.transaction(async tx => {
    await tx.update(tableSessions).set({ status: "CLOSED", closedAt: now, closedByUserId, updatedAt: now }).where(eq(tableSessions.id, sessionId));
    if (orderIds.length) await tx.update(orders).set({ paymentStatus: "PAID", updatedAt: now }).where(inArray(orders.id, orderIds));
    await tx.update(restaurantTables).set({ status: "FREE", updatedAt: now }).where(eq(restaurantTables.id, detail.table!.id));
  });
  return detail;
}

/**
 * Reabre uma comanda fechada por engano. Só permitida enquanto a mesa não
 * tiver sido ocupada de novo por outra comanda nesse meio-tempo — senão
 * ficariam duas comandas "abertas" na mesma mesa ao mesmo tempo.
 */
export async function reopenTableSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!session) throw new Error("Comanda não encontrada.");
  if (session.status !== "CLOSED") throw new Error("Só é possível reabrir uma comanda que já foi fechada.");
  const alreadyOpen = await findOpenSessionForTable(session.tableId);
  if (alreadyOpen) throw new Error("Essa mesa já tem uma comanda aberta agora — não é possível reabrir a anterior.");
  const now = Date.now();
  await db.update(tableSessions).set({ status: "OPEN", closedAt: null, closedByUserId: null, updatedAt: now }).where(eq(tableSessions.id, sessionId));
  await db.update(restaurantTables).set({ status: "OCCUPIED", updatedAt: now }).where(eq(restaurantTables.id, session.tableId));
}

export async function cancelTableSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [session] = await db.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!session) throw new Error("Comanda não encontrada.");
  const now = Date.now();
  await db.update(tableSessions).set({ status: "CANCELLED", closedAt: now, updatedAt: now }).where(eq(tableSessions.id, sessionId));
  await db.update(restaurantTables).set({ status: "FREE", updatedAt: now }).where(eq(restaurantTables.id, session.tableId));
}

/** Últimas comandas fechadas, pra equipe conseguir reabrir uma fechada por engano. */
export async function listRecentClosedSessions(limit = 15) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const closed = await db.select().from(tableSessions).where(eq(tableSessions.status, "CLOSED")).orderBy(desc(tableSessions.closedAt)).limit(limit);
  if (!closed.length) return [];
  const tableIds = closed.map(session => session.tableId);
  const tables = await db.select().from(restaurantTables).where(inArray(restaurantTables.id, tableIds));
  return closed.map(session => ({ session, tableLabel: tables.find(table => table.id === session.tableId)?.label ?? "Mesa" }));
}
