import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { restaurantTables, tableBillPayments, tableSessions } from "../drizzle/schema";
import { getDb } from "./db/client";
import { recordBillPayment } from "./db/tableSessions";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — mesmo
 * raciocínio de order-idempotency-real-db.test.ts: só um banco real prova
 * que um `ER_DUP_ENTRY` capturado não invalida a chamada (o `code` do driver
 * vem em `error.cause`, comportamento específico do mysql2/InnoDB). Pula
 * sozinho se DATABASE_URL não estiver configurada.
 *
 * Fase C do offline-first do painel admin (recordBillPayment era o único
 * ponto genuinamente inseguro sob retry — sem trava, sem transação, sem
 * dedupe, antes desta mudança).
 * `tableBillPayments` não usa FK de verdade (schema não declara nenhuma) —
 * um `tableSessionId` fictício é seguro pra este teste, mesmo padrão de
 * `customerId: 999999` em order-idempotency-real-db.test.ts.
 */
describe.skipIf(!process.env.DATABASE_URL)("recordBillPayment — idempotência contra MySQL real", () => {
  // recordBillPayment agora exige uma comanda REAL e aberta (e trava a mesa),
  // então o teste cria uma mesa + comanda descartáveis e apaga no fim.
  let FAKE_SESSION_ID = 0;
  let testTableId = 0;
  const insertedPaymentOperationIds: string[] = [];

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const now = Date.now();
    const table = await db.insert(restaurantTables).values({ label: "TESTE-PAGTO", qrToken: `t${now}`.slice(0, 24), createdAt: now, updatedAt: now });
    testTableId = Number(table[0].insertId);
    const session = await db.insert(tableSessions).values({ tableId: testTableId, status: "OPEN", openedAt: now, createdAt: now, updatedAt: now });
    FAKE_SESSION_ID = Number(session[0].insertId);
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const clientOperationId of insertedPaymentOperationIds) {
      await db.delete(tableBillPayments).where(eq(tableBillPayments.clientOperationId, clientOperationId));
    }
    if (FAKE_SESSION_ID) await db.delete(tableSessions).where(eq(tableSessions.id, FAKE_SESSION_ID));
    if (testTableId) await db.delete(restaurantTables).where(eq(restaurantTables.id, testTableId));
  });

  it("duas chamadas com o mesmo clientOperationId não duplicam o registro de pagamento", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const operationId = `test-bill-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    insertedPaymentOperationIds.push(operationId);

    await recordBillPayment(FAKE_SESSION_ID, { method: "PIX", amountCents: 1500, clientOperationId: operationId });
    // Segunda chamada, MESMO operationId — simula um retry automático depois
    // de queda de conexão (a resposta da primeira se perdeu, mas o insert já
    // tinha commitado). Não deve lançar nem duplicar.
    await recordBillPayment(FAKE_SESSION_ID, { method: "PIX", amountCents: 1500, clientOperationId: operationId });

    const rows = await db.select().from(tableBillPayments).where(eq(tableBillPayments.clientOperationId, operationId));
    expect(rows).toHaveLength(1);
  });

  it("duas chamadas com clientOperationId DIFERENTE criam dois registros distintos (comportamento normal preservado)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const operationIdA = `test-bill-idem-a-${Date.now()}`;
    const operationIdB = `test-bill-idem-b-${Date.now()}`;
    insertedPaymentOperationIds.push(operationIdA, operationIdB);

    await recordBillPayment(FAKE_SESSION_ID, { method: "CASH", amountCents: 1000, clientOperationId: operationIdA });
    await recordBillPayment(FAKE_SESSION_ID, { method: "CASH", amountCents: 1000, clientOperationId: operationIdB });

    const rowsA = await db.select().from(tableBillPayments).where(eq(tableBillPayments.clientOperationId, operationIdA));
    const rowsB = await db.select().from(tableBillPayments).where(eq(tableBillPayments.clientOperationId, operationIdB));
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
  });

  it("sem clientOperationId, comportamento idêntico a antes — sempre insere um registro novo", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    await recordBillPayment(FAKE_SESSION_ID, { method: "CARD_ON_DELIVERY", amountCents: 500 });
    await recordBillPayment(FAKE_SESSION_ID, { method: "CARD_ON_DELIVERY", amountCents: 500 });

    const rows = await db.select().from(tableBillPayments).where(eq(tableBillPayments.tableSessionId, FAKE_SESSION_ID));
    const nullOperationIdRows = rows.filter(row => row.clientOperationId === null && row.amountCents === 500 && row.method === "CARD_ON_DELIVERY");
    expect(nullOperationIdRows.length).toBeGreaterThanOrEqual(2);
    // Limpeza direta (não tem clientOperationId pra filtrar no afterAll).
    for (const row of nullOperationIdRows) await db.delete(tableBillPayments).where(eq(tableBillPayments.id, row.id));
  });
});
