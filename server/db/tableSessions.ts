import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { orders, restaurantTables, tableBillPayments, tableReservations, tableServiceRequests, tableSessions } from "../../drizzle/schema";
import { getDb, type DbOrTx } from "./client";
import { getOrdersWithDetailsBatch } from "./orders";
import { listTables } from "./tables";

const OPEN_SESSION_STATUSES = ["OPEN", "AWAITING_PAYMENT"] as const;

// ---- Comandas (table_sessions) ----

/**
 * Trava a linha da MESA (SELECT...FOR UPDATE), não da comanda — é o mutex
 * certo aqui porque abrir uma comanda nova não tem linha de comanda nenhuma
 * pra travar ainda. Serializa TODO o ciclo de vida da comanda dessa mesa
 * (abrir, fechar, cancelar, reabrir, pedir a conta): duas chamadas
 * concorrentes pra qualquer uma dessas ações na MESMA mesa disputam esse
 * lock sequencialmente, então a segunda sempre enxerga o resultado real da
 * primeira antes de decidir — nunca correm as duas em cima do mesmo estado
 * "atual" já desatualizado (mesmo padrão de lockLicenseSingletonRow, ver
 * server/db/license.ts). Auditoria Fase 4 (offline-first): sem isso, duas
 * pessoas escaneando o QR da mesma mesa quase ao mesmo tempo podiam abrir
 * DUAS comandas simultâneas pra mesma mesa (sem constraint única no banco
 * pra impedir), e um "fechar" atrasado podia liberar de volta pra FREE uma
 * mesa que já tinha sido ocupada de novo por outra comanda nesse meio-tempo.
 * Só funciona de dentro de db.transaction().
 */
export async function lockTableRow(tx: DbOrTx, tableId: number) {
  await tx.select({ id: restaurantTables.id }).from(restaurantTables).where(eq(restaurantTables.id, tableId)).limit(1).for("update");
}

export async function findOpenSessionForTable(tableId: number, conn?: DbOrTx) {
  const db = conn ?? (await getDb());
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
  // Trava a mesa ANTES de checar "já tem comanda aberta?" — sem isso, duas
  // chamadas quase simultâneas (ex.: dois celulares escaneando o QR da
  // mesma mesa) liam "nenhuma comanda aberta" ao mesmo tempo e as duas
  // inseriam uma comanda nova, dividindo os pedidos entre duas comandas —
  // uma delas ficava órfã, nunca fechada/cobrada (ver auditoria Fase 4).
  return db.transaction(async tx => {
    await lockTableRow(tx, tableId);
    const existing = await findOpenSessionForTable(tableId, tx);
    if (existing) return existing;
    const now = Date.now();
    const result = await tx.insert(tableSessions).values({ tableId, status: "OPEN", partySize: partySize ?? null, openedAt: now, createdAt: now, updatedAt: now });
    const sessionId = Number(result[0].insertId);
    await tx.update(restaurantTables).set({ status: "OCCUPIED", updatedAt: now }).where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.status, "FREE")));
    const [session] = await tx.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
    return session!;
  });
}

/** Aceita `conn` opcional (ex.: um `tx` já aberto por closeTableSession) pra poder ler dentro da mesma transação que travou a mesa — mesmo motivo de getOrderWithDetails (server/db/orders.ts). Sem passar nada, comportamento igual a sempre. */
export async function getSessionWithOrders(sessionId: number, conn?: DbOrTx) {
  const db = conn ?? (await getDb());
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
  const [current] = await db.select({ tableId: tableSessions.tableId }).from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!current) throw new Error("Comanda não encontrada.");
  await db.transaction(async tx => {
    await lockTableRow(tx, current.tableId);
    const [session] = await tx.select({ status: tableSessions.status }).from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Comanda não encontrada.");
    // Só pede a conta de uma comanda ainda aberta — uma chamada atrasada
    // (ex.: cliente tocou "pedir a conta" bem na hora em que a equipe já
    // fechou a comanda) não pode "ressuscitar" uma comanda já
    // fechada/cancelada de volta pra AWAITING_PAYMENT, que conta como
    // "aberta" pra findOpenSessionForTable — uma comanda nova poderia ficar
    // silenciosamente presa numa comanda velha já paga/encerrada.
    if (session.status !== "OPEN" && session.status !== "AWAITING_PAYMENT") return;
    const now = Date.now();
    await tx.update(tableSessions).set({ status: "AWAITING_PAYMENT", billRequestedAt: now, updatedAt: now }).where(eq(tableSessions.id, sessionId));
  });
}

/**
 * `clientOperationId` (opcional) é a chave de idempotência gerada pelo
 * cliente — mesmo padrão de insertPricedOrder (server/routers/order.ts):
 * antes deste dedupe, um retry automático depois de queda de conexão (Fase C
 * do offline-first do painel admin, ver plano em
 * C:\Users\maico\.claude\plans\curried-sprouting-wirth.md) duplicava o
 * registro de pagamento — sem trava, sem transação, um insert simples. Aqui é
 * dinheiro, então precisa do mesmo cuidado já usado em pedidos/rodadas.
 * Quando `clientOperationId` não é informado, comportamento idêntico a antes.
 */
export async function recordBillPayment(sessionId: number, input: { method: "PIX" | "CASH" | "CARD_ON_DELIVERY" | "CARD_ONLINE"; amountCents: number; payerLabel?: string; clientOperationId?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  try {
    await db.insert(tableBillPayments).values({
      tableSessionId: sessionId,
      method: input.method,
      amountCents: input.amountCents,
      payerLabel: input.payerLabel ?? null,
      status: "PAID",
      paidAt: now,
      createdAt: now,
      updatedAt: now,
      clientOperationId: input.clientOperationId ?? null,
    });
  } catch (error) {
    // Mesmo padrão de captura de insertPricedOrder — o `code` do driver
    // (ER_DUP_ENTRY) fica em `error.cause`, não no erro que a gente pega
    // direto (drizzle-orm embrulha num DrizzleQueryError).
    const errorCode = (error as { code?: string; cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code;
    if (input.clientOperationId && errorCode === "ER_DUP_ENTRY") {
      const [existing] = await db.select({ id: tableBillPayments.id }).from(tableBillPayments).where(eq(tableBillPayments.clientOperationId, input.clientOperationId)).limit(1);
      if (existing) return;
    }
    throw error;
  }
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
  // Leitura rápida só pra achar a mesa da comanda — a trava é na linha da
  // MESA (lockTableRow), não da comanda, então precisamos saber qual mesa
  // travar antes de abrir a transação. Tudo que decide o resultado (saldo,
  // status atual) é relido de novo, travado, dentro dela — esta leitura
  // solta aqui não é usada pra nenhuma decisão.
  const [sessionForTable] = await db.select({ tableId: tableSessions.tableId }).from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!sessionForTable) throw new Error("Comanda não encontrada.");
  // As 3 escritas + a trava da mesa, tudo numa transação só — sem isso, um
  // travamento no meio podia fechar a comanda mas deixar os pedidos dela
  // como "não pago" pro relatório financeiro (ou liberar/travar a mesa
  // incoerente com o status real da comanda); e sem a trava, uma chamada de
  // fechamento atrasada/duplicada podia liberar pra FREE uma mesa que já
  // tinha sido ocupada de novo por outra comanda nesse meio-tempo (ver
  // auditoria Fase 4 — corrida real, não hipotética: acontece quando duas
  // pessoas na equipe fecham a mesma comanda quase ao mesmo tempo).
  return db.transaction(async tx => {
    await lockTableRow(tx, sessionForTable.tableId);
    const detail = await getSessionWithOrders(sessionId, tx);
    if (!detail) throw new Error("Comanda não encontrada.");
    // Chamada repetida/atrasada numa comanda que outra chamada já fechou (ou
    // cancelou) nesse meio-tempo: não repete a escrita — em especial não
    // libera a mesa de novo, que pode já estar ocupada por uma comanda NOVA.
    if (detail.session.status !== "OPEN" && detail.session.status !== "AWAITING_PAYMENT") return detail;
    if (detail.balanceDueCents > 0) throw new Error("A conta ainda não foi totalmente paga.");
    const now = Date.now();
    const orderIds = detail.orders.filter(order => order.status !== "CANCELLED").map(order => order.id);
    await tx.update(tableSessions).set({ status: "CLOSED", closedAt: now, closedByUserId, updatedAt: now }).where(eq(tableSessions.id, sessionId));
    if (orderIds.length) await tx.update(orders).set({ paymentStatus: "PAID", updatedAt: now }).where(inArray(orders.id, orderIds));
    await tx.update(restaurantTables).set({ status: "FREE", updatedAt: now }).where(eq(restaurantTables.id, detail.table!.id));
    return detail;
  });
}

/**
 * Reabre uma comanda fechada por engano. Só permitida enquanto a mesa não
 * tiver sido ocupada de novo por outra comanda nesse meio-tempo — senão
 * ficariam duas comandas "abertas" na mesma mesa ao mesmo tempo.
 */
export async function reopenTableSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [current] = await db.select({ tableId: tableSessions.tableId }).from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!current) throw new Error("Comanda não encontrada.");
  // Trava a mesa antes de checar "já foi reaberta?"/"já tem outra comanda
  // aberta?" — as duas checagens (linhas 211-213 originais) precisam ver o
  // estado real, não um instantâneo que outra chamada concorrente (ex.:
  // getOrOpenSessionForTable abrindo uma comanda nova pra essa mesa quase ao
  // mesmo tempo) já invalidou.
  await db.transaction(async tx => {
    await lockTableRow(tx, current.tableId);
    const [session] = await tx.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Comanda não encontrada.");
    if (session.status !== "CLOSED") throw new Error("Só é possível reabrir uma comanda que já foi fechada.");
    const alreadyOpen = await findOpenSessionForTable(session.tableId, tx);
    if (alreadyOpen) throw new Error("Essa mesa já tem uma comanda aberta agora — não é possível reabrir a anterior.");
    const now = Date.now();
    await tx.update(tableSessions).set({ status: "OPEN", closedAt: null, closedByUserId: null, updatedAt: now }).where(eq(tableSessions.id, sessionId));
    await tx.update(restaurantTables).set({ status: "OCCUPIED", updatedAt: now }).where(eq(restaurantTables.id, session.tableId));
  });
}

export async function cancelTableSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [current] = await db.select({ tableId: tableSessions.tableId }).from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
  if (!current) throw new Error("Comanda não encontrada.");
  // Trava a mesa + as 2 escritas numa transação só — antes eram soltas (nem
  // isso tinha) e sem lock: uma comanda que a equipe já FECHOU (ver
  // closeTableSession) nesse meio-tempo não pode ser cancelada por cima —
  // status e orders.paymentStatus ficariam incoerentes entre si (comanda
  // CANCELLED com pedidos já marcados PAID, ou o contrário).
  await db.transaction(async tx => {
    await lockTableRow(tx, current.tableId);
    const [session] = await tx.select().from(tableSessions).where(eq(tableSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Comanda não encontrada.");
    if (session.status !== "OPEN" && session.status !== "AWAITING_PAYMENT") return;
    const now = Date.now();
    await tx.update(tableSessions).set({ status: "CANCELLED", closedAt: now, updatedAt: now }).where(eq(tableSessions.id, sessionId));
    await tx.update(restaurantTables).set({ status: "FREE", updatedAt: now }).where(eq(restaurantTables.id, session.tableId));
  });
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
