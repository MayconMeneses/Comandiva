import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { restaurantTables, tableSessions } from "../drizzle/schema";
import { getDb } from "./db/client";
import { cancelTableSession, closeTableSession, createTable, getOrOpenSessionForTable, requestSessionBill } from "./db";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — mesmo
 * raciocínio de admin-orders-status-lock-real-db.test.ts: SELECT...FOR
 * UPDATE só tem garantia real contra o banco. Prova as duas corridas mais
 * graves encontradas na auditoria Fase 4 (depois do fix em
 * updateOrderStatus) em server/db/tableSessions.ts:
 *
 * 1. getOrOpenSessionForTable: sem a trava da mesa, duas chamadas quase
 *    simultâneas (ex.: dois celulares escaneando o QR da mesma mesa) liam
 *    "nenhuma comanda aberta" ao mesmo tempo e cada uma abria a SUA própria
 *    comanda nova — a mesa ficava com duas comandas "abertas" ao mesmo
 *    tempo, uma delas órfã (pedidos anexados a ela nunca são cobrados,
 *    porque fechar/cobrar sempre olha só pra UMA comanda).
 * 2. closeTableSession: sem a trava, uma chamada de fechamento
 *    atrasada/duplicada (a mesma comanda fechada duas vezes quase ao mesmo
 *    tempo, ou uma reabertura no meio) podia liberar a mesa pra FREE mesmo
 *    depois dela já ter sido ocupada de novo por uma comanda nova.
 *
 * Pula sozinho se DATABASE_URL não estiver configurada.
 */
describe.skipIf(!process.env.DATABASE_URL)("tableSessions — trava de linha da mesa contra MySQL real", () => {
  const createdTableIds: number[] = [];

  afterAll(async () => {
    const db = await getDb();
    if (!db || !createdTableIds.length) return;
    for (const tableId of createdTableIds) {
      await db.delete(tableSessions).where(eq(tableSessions.tableId, tableId));
      await db.delete(restaurantTables).where(eq(restaurantTables.id, tableId));
    }
  });

  async function createTestTable() {
    const tableId = await createTable({ label: "Mesa de teste (lock)", sector: "Teste", capacity: 4 });
    createdTableIds.push(tableId);
    return tableId;
  }

  it("duas chamadas concorrentes de getOrOpenSessionForTable pra MESMA mesa nunca abrem duas comandas — a segunda enxerga a da primeira", async () => {
    const tableId = await createTestTable();

    const [sessionA, sessionB] = await Promise.all([getOrOpenSessionForTable(tableId), getOrOpenSessionForTable(tableId)]);

    // A prova principal: as duas chamadas concorrentes convergem pra UMA
    // única comanda — antes da trava, essa asserção falhava às vezes
    // (corrida vencível, sessionA.id !== sessionB.id); com FOR UPDATE na
    // linha da mesa, é determinístico.
    expect(sessionA.id).toBe(sessionB.id);

    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const openSessions = await db.select().from(tableSessions).where(eq(tableSessions.tableId, tableId));
    expect(openSessions.filter(session => session.status === "OPEN")).toHaveLength(1);

    const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableId)).limit(1);
    expect(table?.status).toBe("OCCUPIED");
  });

  it("closeTableSession numa comanda já fechada é um no-op seguro — não libera de volta pra FREE uma mesa já ocupada por uma comanda nova", async () => {
    const tableId = await createTestTable();

    const sessionA = await getOrOpenSessionForTable(tableId);
    await closeTableSession(sessionA.id, null); // mesa volta pra FREE aqui
    const sessionB = await getOrOpenSessionForTable(tableId); // mesa OCCUPIED de novo, comanda NOVA

    // Chamada de fechamento atrasada/duplicada pra comanda A (já fechada) —
    // sem o guard, isso reaplicaria "mesa = FREE" por cima da mesa que a
    // comanda B já está usando de verdade agora.
    await closeTableSession(sessionA.id, null);

    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, tableId)).limit(1);
    expect(table?.status).toBe("OCCUPIED"); // NÃO foi liberada por engano

    const [refreshedSessionB] = await db.select().from(tableSessions).where(eq(tableSessions.id, sessionB.id)).limit(1);
    expect(refreshedSessionB?.status).toBe("OPEN"); // comanda B continua intacta
  });

  it("cancelTableSession numa comanda que já foi FECHADA (não cancelada) é um no-op — não deixa status/pagamento incoerentes", async () => {
    const tableId = await createTestTable();
    const session = await getOrOpenSessionForTable(tableId);
    await closeTableSession(session.id, null);

    // Chamada de cancelamento atrasada pra uma comanda que já foi fechada
    // (ex.: garçom achou que o cliente saiu sem pagar, mas o caixa já tinha
    // fechado a conta um instante antes) — sem o guard, isso sobrescreveria
    // CLOSED por CANCELLED mesmo com os pedidos já marcados como pagos.
    await cancelTableSession(session.id);

    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const [refreshed] = await db.select().from(tableSessions).where(eq(tableSessions.id, session.id)).limit(1);
    expect(refreshed?.status).toBe("CLOSED"); // continua CLOSED, não virou CANCELLED
  });

  it("requestSessionBill numa comanda já FECHADA não a ressuscita pra AWAITING_PAYMENT", async () => {
    const tableId = await createTestTable();
    const session = await getOrOpenSessionForTable(tableId);
    await closeTableSession(session.id, null);

    // Cliente tocou "pedir a conta" bem na hora em que a equipe já fechou a
    // comanda — sem o guard, isso "ressuscitaria" a comanda de volta pra um
    // status que findOpenSessionForTable trata como aberto, e uma comanda
    // nova poderia ficar presa nela sem querer.
    await requestSessionBill(session.id);

    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const [refreshed] = await db.select().from(tableSessions).where(eq(tableSessions.id, session.id)).limit(1);
    expect(refreshed?.status).toBe("CLOSED"); // continua CLOSED, não virou AWAITING_PAYMENT
  });
});
