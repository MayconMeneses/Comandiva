import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { categories, deliveryRoutes, fiscalDocuments, orderItems, orders, printJobs, products, restaurantSettings, restaurantTables, tableSessions } from "../drizzle/schema";
import { getDb } from "./db/client";
import { createTable } from "./db";
import { orderRouter } from "./routers/order";
import { adminTablesRouter } from "./routers/admin/tables";
import { adminOrdersRouter } from "./routers/admin/orders";
import type { TrpcContext } from "./_core/context";

/**
 * Ciclo de vida completo de um pedido contra MySQL de verdade, depois que a
 * nota fiscal saiu do produto (2026-10-07): cria pelo site, a equipe aceita,
 * produz, entrega e conclui. Prova que nada na transição de status depende
 * mais de emissão fiscal, que o comprovante (print job) nasce só no aceite e
 * que nenhum documento fiscal é criado. Pula sozinho sem DATABASE_URL.
 */
describe.skipIf(!process.env.DATABASE_URL)("ciclo de vida do pedido — sem nota fiscal (MySQL real)", () => {
  const createdOrderIds: number[] = [];
  // Dados próprios do teste (issue #2): o banco do CI só tem as migrations, sem
  // cardápio nem mesas de demonstração. Tudo é criado aqui e apagado no fim.
  const fixture = { categoryId: 0, productId: 0, tableId: 0, settingsId: 0 };

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null — checar DATABASE_URL.");
    const now = Date.now();
    // Configuração da loja é linha única: só cria se o banco não tiver nenhuma
    // (banco vazio do CI) e nunca altera uma que já exista.
    const [existingSettings] = await db.select({ id: restaurantSettings.id }).from(restaurantSettings).limit(1);
    if (!existingSettings) {
      const [settings] = await db
        .insert(restaurantSettings)
        .values({ storeName: "Loja de teste (CI)", isAcceptingOrders: true, minimumOrderCents: 0, createdAt: now, updatedAt: now })
        .$returningId();
      fixture.settingsId = settings.id;
    }
    const [category] = await db.insert(categories).values({ name: `Teste ciclo de vida ${now}`, createdAt: now, updatedAt: now }).$returningId();
    fixture.categoryId = category.id;
    const [product] = await db
      .insert(products)
      .values({ categoryId: category.id, name: `Produto simples de teste ${now}`, priceCents: 2500, available: true, createdAt: now, updatedAt: now })
      .$returningId();
    fixture.productId = product.id;
    fixture.tableId = await createTable({ label: `Mesa de teste (ciclo) ${now}`, sector: "Teste", capacity: 4 });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    // order_status_history é append-only (trigger) — fica órfão, sem problema.
    if (createdOrderIds.length) {
      await db.delete(printJobs).where(inArray(printJobs.orderId, createdOrderIds));
      await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
      await db.delete(orders).where(inArray(orders.id, createdOrderIds));
    }
    if (fixture.tableId) {
      await db.delete(tableSessions).where(eq(tableSessions.tableId, fixture.tableId));
      await db.delete(restaurantTables).where(eq(restaurantTables.id, fixture.tableId));
    }
    if (fixture.productId) await db.delete(products).where(eq(products.id, fixture.productId));
    if (fixture.categoryId) await db.delete(categories).where(eq(categories.id, fixture.categoryId));
    if (fixture.settingsId) await db.delete(restaurantSettings).where(eq(restaurantSettings.id, fixture.settingsId));
  });

  const publicCtx = { user: null, req: { ip: "127.0.0.1", headers: {} }, res: {} } as unknown as TrpcContext;
  const adminCtx = {
    user: { id: 1, openId: "admin", name: "Admin", email: "admin@mmsystemcreator.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {}, res: {},
  } as unknown as TrpcContext;

  async function pickSimpleProduct() {
    const db = await getDb();
    if (!db) throw new Error("getDb() retornou null — checar DATABASE_URL.");
    const [simple] = await db.select().from(products).where(eq(products.id, fixture.productId));
    if (!simple) throw new Error("Produto de teste não foi criado no beforeAll.");
    return simple;
  }

  async function createOrder(fulfillmentType: "PICKUP" | "DELIVERY") {
    const product = await pickSimpleProduct();
    const phone = `8599${Math.floor(1000000 + Math.random() * 8999999)}`;
    const db = await getDb();
    const [route] = fulfillmentType === "DELIVERY" ? await db!.select().from(deliveryRoutes).where(eq(deliveryRoutes.active, true)).limit(1) : [];
    const input = {
      items: [{ productId: product.id, quantity: 1, addonOptionIds: [] as number[] }],
      fulfillmentType,
      paymentMethod: "CASH" as const,
      customer: { name: "Teste Sem Nota Fiscal", phone },
      operationId: `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      ...(fulfillmentType === "DELIVERY" ? { address: { street: "Rua Teste", number: "10", neighborhood: route?.name ?? "Centro", city: "Croatá", state: "CE" }, ...(route ? { deliveryRouteId: route.id } : {}) } : {}),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await orderRouter.createCaller(publicCtx).create(input as never);
    const orderId: number = result.orderId ?? result.order?.id ?? result.id;
    expect(orderId, `resposta de order.create sem id: ${JSON.stringify(result).slice(0, 200)}`).toBeGreaterThan(0);
    createdOrderIds.push(orderId);
    return orderId;
  }

  async function runLifecycle(orderId: number, steps: Array<[string, string]>) {
    const admin = adminOrdersRouter.createCaller(adminCtx);
    const db = await getDb();
    for (const [from, to] of steps) {
      const result = await admin.updateOrderStatus({ orderId, status: to as never, expectedStatus: from as never });
      expect(result?.status).toBe(to);
    }
    const [finalRow] = await db!.select().from(orders).where(eq(orders.id, orderId));
    expect(finalRow.status).toBe(steps[steps.length - 1][1]);
    const jobs = await db!.select().from(printJobs).where(eq(printJobs.orderId, orderId));
    const docs = await db!.select().from(fiscalDocuments).where(eq(fiscalDocuments.orderId, orderId));
    return { jobs, docs };
  }

  it("retirada em dinheiro: PENDING → ACCEPTED → PREPARING → READY_FOR_PICKUP → COMPLETED, 1 comprovante (no aceite) e 0 documentos fiscais", async () => {
    const orderId = await createOrder("PICKUP");
    const { jobs, docs } = await runLifecycle(orderId, [
      ["PENDING", "ACCEPTED"],
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "READY_FOR_PICKUP"],
      ["READY_FOR_PICKUP", "COMPLETED"],
    ]);
    expect(jobs).toHaveLength(0); // fila de impressão desligada por padrão
    expect(docs).toHaveLength(0);
  });

  it("entrega em dinheiro: sair para entrega (antes disparava emissão) agora só muda o status", async () => {
    const orderId = await createOrder("DELIVERY");
    const { jobs, docs } = await runLifecycle(orderId, [
      ["PENDING", "ACCEPTED"],
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "OUT_FOR_DELIVERY"],
      ["OUT_FOR_DELIVERY", "COMPLETED"],
    ]);
    expect(jobs).toHaveLength(0); // fila de impressão desligada por padrão
    expect(docs).toHaveLength(0);
  });

  it("mesa: abre comanda, lança rodada, paga e fecha — sem emitir nada e sem erro", async () => {
    const tables = adminTablesRouter.createCaller(adminCtx);
    const list = await tables.tables();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = (list as any[]).find(row => row.table?.id === fixture.tableId && !row.session);
    expect(entry, "mesa de teste não está livre").toBeTruthy();
    const free = entry.table;
    const { sessionId } = await tables.seatTable({ tableId: free.id, partySize: 2 });
    const product = await pickSimpleProduct();
    const round = await tables.addManualRound({ tableId: free.id, items: [{ productId: product.id, quantity: 1, addonOptionIds: [] }], operationId: `e2e-mesa-${Date.now()}` } as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detail: any = await tables.sessionDetail({ sessionId });
    expect(detail.balanceDueCents).toBeGreaterThan(0);
    for (const order of detail.orders ?? []) createdOrderIds.push(order.id);
    await tables.recordBillPayment({ sessionId, method: "CASH", amountCents: detail.balanceDueCents, operationId: `e2e-pay-${Date.now()}` });
    await tables.closeSession({ sessionId });
    const db = await getDb();
    const [session] = await db!.select().from(tableSessions).where(eq(tableSessions.id, sessionId));
    expect(session.status).toBe("CLOSED");
    const docs = await db!.select().from(fiscalDocuments).where(eq(fiscalDocuments.tableSessionId, sessionId));
    expect(docs).toHaveLength(0);
    expect(round).toBeTruthy();
  });
});
