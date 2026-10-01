import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { tableReservations } from "../drizzle/schema";
import { getDb } from "./db/client";
import { createReservation } from "./db/tableReservations";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — mesmo
 * raciocínio de admin-record-bill-payment-idempotency-real-db.test.ts: só um
 * banco real prova que um `ER_DUP_ENTRY` capturado não invalida a chamada (o
 * `code` do driver vem em `error.cause`, comportamento específico do
 * mysql2/InnoDB). Pula sozinho se DATABASE_URL não estiver configurada.
 *
 * Frente 2 (Fase 3) — `createReservation` era a única mutation do plano
 * genuinamente insegura pra repetir (INSERT simples, sem dedupe): um
 * duplo-clique ou um reenvio depois de rede falhar criava reserva duplicada
 * de verdade. Mesmo padrão de `recordBillPayment`.
 */
describe.skipIf(!process.env.DATABASE_URL)("createReservation — idempotência contra MySQL real", () => {
  const insertedReservationOperationIds: string[] = [];
  const insertedReservationIds: number[] = [];

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const clientOperationId of insertedReservationOperationIds) {
      await db.delete(tableReservations).where(eq(tableReservations.clientOperationId, clientOperationId));
    }
    for (const id of insertedReservationIds) {
      await db.delete(tableReservations).where(eq(tableReservations.id, id));
    }
  });

  it("duas chamadas com o mesmo clientOperationId não duplicam a reserva — a segunda devolve o id da primeira sem lançar", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const operationId = `test-reservation-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    insertedReservationOperationIds.push(operationId);

    const firstId = await createReservation({ customerName: "Cliente de teste (idem)", customerPhone: "85999990001", partySize: 2, reservedFor: Date.now() + 2 * 60 * 60 * 1000, clientOperationId: operationId });
    // Segunda chamada, MESMO clientOperationId — simula um duplo-clique ou
    // um reenvio automático depois de queda de conexão (a resposta da
    // primeira se perdeu, mas o insert já tinha comitado). Não deve lançar
    // nem inserir uma segunda linha.
    const secondId = await createReservation({ customerName: "Cliente de teste (idem)", customerPhone: "85999990001", partySize: 2, reservedFor: Date.now() + 2 * 60 * 60 * 1000, clientOperationId: operationId });

    expect(secondId).toBe(firstId);
    const rows = await db.select().from(tableReservations).where(eq(tableReservations.clientOperationId, operationId));
    expect(rows).toHaveLength(1);
  });

  it("duas chamadas com clientOperationId DIFERENTE (ou ambos omitidos) criam duas reservas distintas — comportamento normal preservado", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const operationIdA = `test-reservation-idem-a-${Date.now()}`;
    const operationIdB = `test-reservation-idem-b-${Date.now()}`;
    insertedReservationOperationIds.push(operationIdA, operationIdB);

    const idA = await createReservation({ customerName: "Cliente A (idem)", customerPhone: "85999990002", partySize: 3, reservedFor: Date.now() + 3 * 60 * 60 * 1000, clientOperationId: operationIdA });
    const idB = await createReservation({ customerName: "Cliente B (idem)", customerPhone: "85999990003", partySize: 4, reservedFor: Date.now() + 4 * 60 * 60 * 1000, clientOperationId: operationIdB });
    expect(idA).not.toBe(idB);

    const rowsA = await db.select().from(tableReservations).where(eq(tableReservations.clientOperationId, operationIdA));
    const rowsB = await db.select().from(tableReservations).where(eq(tableReservations.clientOperationId, operationIdB));
    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);

    // Sem clientOperationId nenhum (chamador antigo/retrocompatível): duas
    // chamadas idênticas continuam criando duas reservas, como sempre.
    const idC = await createReservation({ customerName: "Cliente C (idem, sem operationId)", customerPhone: "85999990004", partySize: 2, reservedFor: Date.now() + 5 * 60 * 60 * 1000 });
    const idD = await createReservation({ customerName: "Cliente C (idem, sem operationId)", customerPhone: "85999990004", partySize: 2, reservedFor: Date.now() + 5 * 60 * 60 * 1000 });
    insertedReservationIds.push(idC, idD);
    expect(idC).not.toBe(idD);
  });
});
