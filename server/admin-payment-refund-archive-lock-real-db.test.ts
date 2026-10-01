import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { orderChangeLogs, orderItems, orders, payments } from "../drizzle/schema";
import { getDb } from "./db/client";
import { insertPricedOrder } from "./routers/order";
import { adminOrdersRouter } from "./routers/admin/orders";
import type { TrpcContext } from "./_core/context";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — mesmo
 * raciocínio de admin-orders-status-lock-real-db.test.ts: SELECT...FOR UPDATE
 * só tem garantia real contra o banco (um mock só prova a ORDEM da lógica,
 * não que o lock de fato serializa duas transações concorrentes). Pula
 * sozinho se DATABASE_URL não estiver configurada.
 *
 * Prova a corrida real descrita no plano (Frente 2 — Fase 3, item 2.1):
 * `markPaymentRefunded`/`archiveOrder` faziam SELECT fora de transação,
 * checavam o status em memória, e só DEPOIS escreviam — duas chamadas quase
 * simultâneas (duplo clique, ou duas abas do mesmo admin) podiam ambas
 * passar pela checagem e ambas escrever, duplicando a linha de auditoria em
 * `orderChangeLogs` (não duplica reembolso de dinheiro de verdade — nenhuma
 * API de gateway é chamada aqui, só registro interno). Com o lock
 * (SELECT...FOR UPDATE dentro de db.transaction, mesmo padrão de
 * updateOrderStatus), só uma das duas chamadas concorrentes aplica a
 * escrita; a outra, ao ser desbloqueada, enxerga o estado já mudado pela
 * primeira e rejeita.
 */
describe.skipIf(!process.env.DATABASE_URL)("admin.markPaymentRefunded / admin.archiveOrder — trava de linha contra MySQL real", () => {
  const insertedOrderIds: number[] = [];

  afterAll(async () => {
    const db = await getDb();
    if (!db || !insertedOrderIds.length) return;
    // order_change_logs é append-only (trigger no banco, ver CLAUDE.md) —
    // DELETE nela é rejeitado pelo próprio MySQL; igual order_status_history
    // nos outros testes reais, fica órfã sem problema (schema não usa FK de
    // verdade).
    for (const orderId of insertedOrderIds) {
      await db.delete(payments).where(eq(payments.orderId, orderId));
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
  });

  async function createTestOrder() {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const fakePriced = {
      items: [{ product: { id: 999999, name: "Produto de teste (lock refund/archive)" }, quantity: 1, note: undefined, addons: [], unitPriceCents: 1000, lineTotalCents: 1000 }],
      deliveryRoute: undefined,
      subtotalCents: 1000,
      deliveryFeeCents: 0,
      discountCents: 0,
      totalCents: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const result = await db.transaction(tx => insertPricedOrder({
      db: tx,
      priced: fakePriced,
      fulfillmentType: "PICKUP",
      origin: "BALCAO",
      paymentMethod: "CASH",
      customerId: 999999,
      customerName: "Cliente de teste (lock refund/archive)",
      customerPhone: "85999990000",
      now: Date.now(),
    }));
    insertedOrderIds.push(result.orderId);
    return result.orderId;
  }

  const adminContext = {
    user: { id: 1, openId: "admin", name: "Admin", email: "admin@mmsystemcreator.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {}, res: {},
  } as unknown as TrpcContext;

  it("duas chamadas concorrentes de markPaymentRefunded pro mesmo pedido: só UM registro PAYMENT_REFUNDED em orderChangeLogs", async () => {
    const orderId = await createTestOrder();
    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const now = Date.now();
    // insertPricedOrder (server/routers/order.ts) é só o helper de pedido+itens
    // — quem grava `payments` é o handler da mutation `order.create` (fora do
    // helper). Pra este teste, insere a linha de pagamento diretamente já como
    // PAID (achado corrigindo este teste: um `UPDATE` aqui não tinha nenhuma
    // linha pra atualizar, fazendo markPaymentRefunded rejeitar as duas
    // chamadas com NOT_FOUND em vez de provar a trava de concorrência).
    await db.insert(payments).values({ orderId, method: "CASH", status: "PAID", amountCents: 1000, paidAt: now, createdAt: now, updatedAt: now });

    const caller = adminOrdersRouter.createCaller(adminContext);
    const [resultA, resultB] = await Promise.allSettled([
      caller.markPaymentRefunded({ orderId, reason: "Cliente desistiu (chamada A)" }),
      caller.markPaymentRefunded({ orderId, reason: "Cliente desistiu (chamada B)" }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter(outcome => outcome.status === "fulfilled");
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");
    // A segunda chamada enxerga, já travada atrás da primeira, o pagamento
    // já REFUNDED — e rejeita por BAD_REQUEST (mesma mensagem de "status
    // errado" de sempre), não por uma corrida vencível.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "BAD_REQUEST" });

    const [finalPayment] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
    expect(finalPayment?.status).toBe("REFUNDED");
    const refundLogs = (await db.select().from(orderChangeLogs).where(eq(orderChangeLogs.orderId, orderId))).filter(entry => entry.changeType === "PAYMENT_REFUNDED");
    expect(refundLogs).toHaveLength(1);
  });

  it("duas chamadas concorrentes de archiveOrder pro mesmo pedido: só UM registro ORDER_ARCHIVED em orderChangeLogs", async () => {
    const orderId = await createTestOrder();
    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    // archiveOrder só aceita pedido COMPLETED ou CANCELLED — o pedido nasce
    // PENDING via insertPricedOrder, então avança direto pra COMPLETED.
    await db.update(orders).set({ status: "COMPLETED", updatedAt: Date.now() }).where(eq(orders.id, orderId));

    const caller = adminOrdersRouter.createCaller(adminContext);
    const [resultA, resultB] = await Promise.allSettled([
      caller.archiveOrder({ orderId }),
      caller.archiveOrder({ orderId }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter(outcome => outcome.status === "fulfilled");
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");
    // A segunda chamada enxerga, já travada atrás da primeira, o pedido já
    // arquivado — e rejeita com NOT_FOUND (mesmo comportamento de sempre pra
    // "pedido já arquivado"), não duplica a escrita.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "NOT_FOUND" });

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    expect(finalOrder?.archivedAt).not.toBeNull();
    const archiveLogs = (await db.select().from(orderChangeLogs).where(eq(orderChangeLogs.orderId, orderId))).filter(entry => entry.changeType === "ORDER_ARCHIVED");
    expect(archiveLogs).toHaveLength(1);
  });
});
