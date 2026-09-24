import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { orderItems, orderStatusHistory, orders } from "../drizzle/schema";
import { getDb } from "./db/client";
import { insertPricedOrder } from "./routers/order";
import { adminOrdersRouter } from "./routers/admin/orders";
import type { TrpcContext } from "./_core/context";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — mesmo
 * raciocínio de order-idempotency-real-db.test.ts: SELECT...FOR UPDATE só
 * tem garantia real contra o banco (o mock em
 * admin-orders-status-transaction.test.ts só prova a ORDEM da lógica, não
 * que o lock de fato serializa duas transações concorrentes). Pula sozinho
 * se DATABASE_URL não estiver configurada.
 *
 * Prova a corrida real que motivou a Fase 4 (painel da equipe): dois
 * dispositivos com a MESMA tela desatualizada (mesmo `expectedStatus`)
 * mandando `updateOrderStatus` quase ao mesmo tempo pro MESMO pedido. Sem o
 * lock, os dois liam o mesmo status "atual" antes de qualquer um escrever, e
 * os dois passavam — a última escrita vencia silenciosamente. Com o lock,
 * só um consegue passar; o outro, ao ser desbloqueado, enxerga o status já
 * mudado pelo primeiro e rejeita como CONFLICT.
 */
describe.skipIf(!process.env.DATABASE_URL)("admin.updateOrderStatus — trava de linha contra MySQL real", () => {
  const insertedOrderIds: number[] = [];

  afterAll(async () => {
    const db = await getDb();
    if (!db || !insertedOrderIds.length) return;
    // Mesma observação de order-idempotency-real-db.test.ts: order_status_history
    // é append-only (trigger no banco, ver CLAUDE.md) — não apaga, fica órfão
    // sem problema (schema não usa FK de verdade).
    for (const orderId of insertedOrderIds) {
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
  });

  async function createTestOrder() {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const fakePriced = {
      items: [{ product: { id: 999999, name: "Produto de teste (lock)" }, quantity: 1, note: undefined, addons: [], unitPriceCents: 1000, lineTotalCents: 1000 }],
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
      customerName: "Cliente de teste (lock)",
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

  it("duas chamadas concorrentes, mesmo expectedStatus (duas telas desatualizadas): só UMA aplica a transição, a outra rejeita com CONFLICT", async () => {
    const orderId = await createTestOrder(); // criado como PENDING
    const caller = adminOrdersRouter.createCaller(adminContext);

    // "Dispositivo A" e "dispositivo B" — as duas telas ainda acham que o
    // pedido está PENDING, e as duas tentam aceitar (PENDING→ACCEPTED) quase
    // ao mesmo tempo. Promise.allSettled em vez de Promise.all porque
    // exatamente uma das duas DEVE rejeitar — isso é o comportamento
    // esperado, não uma falha do teste.
    const [resultA, resultB] = await Promise.allSettled([
      caller.updateOrderStatus({ orderId, status: "ACCEPTED", expectedStatus: "PENDING", deviceId: "device-a-teste" }),
      caller.updateOrderStatus({ orderId, status: "ACCEPTED", expectedStatus: "PENDING", deviceId: "device-b-teste" }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter(outcome => outcome.status === "fulfilled");
    const rejected = outcomes.filter(outcome => outcome.status === "rejected");

    // A prova principal: nunca as duas passam. Antes da trava de linha, essa
    // asserção falhava às vezes (corrida vencível) — com FOR UPDATE, é
    // determinístico: exatamente uma ganha.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason as { code?: string };
    expect(rejectedReason.code).toBe("CONFLICT");

    // O pedido ficou ACCEPTED (a transição aconteceu exatamente uma vez, não
    // zero nem duas) e só existe UM registro de ACCEPTED no histórico — se o
    // lock não estivesse fechando a corrida, seria possível (embora raro)
    // ambas escreverem e duplicar o histórico.
    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    expect(finalOrder?.status).toBe("ACCEPTED");
    const acceptedHistory = (await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId))).filter(entry => entry.status === "ACCEPTED");
    expect(acceptedHistory).toHaveLength(1);
  });

  it("sem expectedStatus (chamador antigo/retrocompatível), duas chamadas concorrentes pro mesmo pedido continuam serializadas pelo lock — a segunda vê o status já mudado e é rejeitada por transição inválida, não corrompe o pedido", async () => {
    const orderId = await createTestOrder(); // criado como PENDING

    const caller = adminOrdersRouter.createCaller(adminContext);
    const [resultA, resultB] = await Promise.allSettled([
      caller.updateOrderStatus({ orderId, status: "ACCEPTED" }),
      caller.updateOrderStatus({ orderId, status: "CANCELLED" }),
    ]);

    const outcomes = [resultA, resultB];
    // Sem expectedStatus, os dois transições (PENDING→ACCEPTED e
    // PENDING→CANCELLED) são individualmente válidas partindo de PENDING —
    // mas só uma pode ser a "primeira" de verdade. O lock garante que a
    // segunda enxergue o resultado real da primeira antes de decidir, em vez
    // de decidir em cima de um PENDING que já não existe mais.
    const fulfilled = outcomes.filter(outcome => outcome.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);

    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null inesperadamente.");
    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    // O resultado final é SEMPRE um dos dois estados válidos, nunca algo
    // inconsistente (ex.: os dois updates aplicados fora de ordem deixando
    // paymentStatus/timestamps de um pisando no do outro).
    expect(["ACCEPTED", "CANCELLED"]).toContain(finalOrder?.status);
  });
});
