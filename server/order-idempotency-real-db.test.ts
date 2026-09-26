import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { orders, orderItems, orderStatusHistory } from "../drizzle/schema";
import { getDb } from "./db/client";
import { insertPricedOrder } from "./routers/order";

/**
 * Roda contra um MySQL de verdade (`DATABASE_URL`), não mock — é a única
 * forma confiável de provar que um erro de chave duplicada (`ER_DUP_ENTRY`)
 * dentro de uma transação não invalida o resto dela no MySQL/InnoDB
 * (diferente do Postgres). Nenhum teste existente neste projeto tinha
 * verificado isso contra um banco real antes (todos os testes de
 * webhookEvents/paymentService usam getDb() mockado). Pula sozinho se
 * DATABASE_URL não estiver configurada (CI passa a var pro step de `pnpm
 * test`; localmente já existe em .env).
 *
 * Ver plano: C:\Users\maico\.claude\plans\lovely-purring-dusk.md
 */
describe.skipIf(!process.env.DATABASE_URL)("insertPricedOrder — idempotência contra MySQL real", () => {
  const insertedOrderIds: number[] = [];
  const fakePriced = {
    items: [{ product: { id: 999999, name: "Produto de teste (idempotência)" }, quantity: 1, note: undefined, addons: [], unitPriceCents: 1234, lineTotalCents: 1234 }],
    deliveryRoute: undefined,
    subtotalCents: 1234,
    deliveryFeeCents: 0,
    discountCents: 0,
    totalCents: 1234,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;

  function baseParams(clientOperationId?: string) {
    return {
      priced: fakePriced,
      fulfillmentType: "PICKUP" as const,
      origin: "SITE" as const,
      paymentMethod: "CASH" as const,
      customerId: 999999,
      customerName: "Cliente de teste (idempotência)",
      customerPhone: "85999990000",
      clientOperationId,
      now: Date.now(),
    };
  }

  afterAll(async () => {
    const db = await getDb();
    if (!db || !insertedOrderIds.length) return;
    // Limpeza — não deixar lixo de teste no banco de dev local (CI usa um
    // container efêmero, não precisaria, mas rodar local repetidas vezes sim).
    // order_status_history É de propósito somente-leitura após criado
    // (trigger append-only no banco, ver CLAUDE.md) — não dá pra apagar, e
    // não tem FK travando o delete de `orders` por causa disso (schema não
    // usa FK de verdade, só índices), então fica órfão sem problema.
    for (const orderId of insertedOrderIds) {
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
  });

  it("duas chamadas com o mesmo clientOperationId, dentro de uma transação, devolvem o MESMO pedido — sem lançar erro", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const operationId = `test-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const first = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(operationId) }));
    insertedOrderIds.push(first.orderId);
    expect(first.isDuplicate).toBe(false);

    // Segunda chamada, MESMO operationId — simula um resubmit/retry. Isso é
    // o que prova que um ER_DUP_ENTRY capturado no meio de uma transação não
    // invalida o resto dela no MySQL: se invalidasse, esta segunda chamada
    // lançaria um erro cru em vez de devolver o pedido já existente.
    const second = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(operationId) }));

    expect(second.isDuplicate).toBe(true);
    expect(second.orderId).toBe(first.orderId);
    expect(second.code).toBe(first.code);

    // Confirma que NÃO duplicou orderItems/orderStatusHistory — só a primeira
    // chamada gravou.
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, first.orderId));
    expect(items).toHaveLength(1);
    const history = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, first.orderId));
    expect(history).toHaveLength(1);
  });

  it("duas chamadas com clientOperationId DIFERENTE criam dois pedidos distintos (comportamento normal preservado)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const first = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(`test-idem-a-${Date.now()}`) }));
    const second = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(`test-idem-b-${Date.now()}`) }));
    insertedOrderIds.push(first.orderId, second.orderId);

    expect(first.orderId).not.toBe(second.orderId);
    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(false);
  });

  it("sem clientOperationId, comportamento idêntico a antes — sempre cria um pedido novo", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const first = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(undefined) }));
    const second = await db.transaction(tx => insertPricedOrder({ db: tx, ...baseParams(undefined) }));
    insertedOrderIds.push(first.orderId, second.orderId);

    expect(first.orderId).not.toBe(second.orderId);
    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(false);
  });
});
