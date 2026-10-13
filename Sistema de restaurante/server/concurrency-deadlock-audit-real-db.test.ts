import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { orderItems, orders, restaurantTables, tableBillPayments, tableSessions } from "../drizzle/schema";
import { getDb } from "./db/client";
import { closeTableSession, createTable, getOrOpenSessionForTable, recordBillPayment } from "./db";
import { insertPricedOrder } from "./routers/order";
import { adminOrdersRouter } from "./routers/admin/orders";
import type { TrpcContext } from "./_core/context";

/**
 * Fase 6 (teste de caos), item 3: auditoria de DEADLOCK (não só de
 * serialização) nas funções travadas por FOR UPDATE — closeTableSession/
 * reopenTableSession/cancelTableSession/requestSessionBill/
 * getOrOpenSessionForTable (server/db/tableSessions.ts) + updateOrderStatus
 * (server/routers/admin/orders.ts). Um deadlock seria PIOR que o bug
 * original: em vez de rejeitar educadamente com CONFLICT, o InnoDB mata uma
 * das transações no meio (erro 1213/ER_LOCK_DEADLOCK) ou, na pior hipótese
 * de um bug de verdade, trava o processo esperando indefinidamente.
 *
 * Análise estática primeiro (a base pra decidir o que vale testar contra
 * banco real): um deadlock exige um CICLO — T1 segura A e quer B, T2 segura
 * B e quer A. Das 5 funções de tableSessions.ts, todas travam a linha da
 * MESA (lockTableRow/restaurantTables) como primeiríssima operação da
 * transação; só UMA delas (closeTableSession) toca `orders` depois disso —
 * as outras 4 (getOrOpenSessionForTable, requestSessionBill,
 * reopenTableSession, cancelTableSession) nunca tocam `orders` dentro da
 * transação, então não têm como formar ciclo com updateOrderStatus (que só
 * trava `orders`, nunca `restaurantTables`). Isso deixa exatamente UM par
 * capaz de disputar duas tabelas em ordens "opostas" na aparência —
 * closeTableSession (restaurantTables → orders) vs. updateOrderStatus (só
 * orders) — mas como updateOrderStatus nunca pede restaurantTables, a
 * dependência é sempre unidirecional (closeTableSession pode esperar
 * updateOrderStatus, o contrário nunca acontece), o que estruturalmente
 * impede o ciclo. Este teste prova isso contra MySQL de verdade: dispara os
 * dois exatamente no pedido/mesa que mais se sobrepõem e confirma que nunca
 * aparece erro de deadlock nem timeout.
 */
describe.skipIf(!process.env.DATABASE_URL)("Fase 6 — auditoria de deadlock: closeTableSession × updateOrderStatus disputando a mesma mesa/pedido", () => {
  const createdTableIds: number[] = [];
  const createdSessionIds: number[] = [];
  const insertedOrderIds: number[] = [];

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    for (const orderId of insertedOrderIds) {
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));
    }
    for (const sessionId of createdSessionIds) {
      await db.delete(tableBillPayments).where(eq(tableBillPayments.tableSessionId, sessionId));
      await db.delete(tableSessions).where(eq(tableSessions.id, sessionId));
    }
    for (const tableId of createdTableIds) {
      await db.delete(restaurantTables).where(eq(restaurantTables.id, tableId));
    }
  });

  const adminContext = {
    user: { id: 1, openId: "admin", name: "Admin", email: "admin@mmsystemcreator.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {}, res: {},
  } as unknown as TrpcContext;

  it("closeTableSession (trava restaurantTables → orders) concorrente com updateOrderStatus (trava só orders) no MESMO pedido: nunca ER_LOCK_DEADLOCK, as duas terminam", async () => {
    const tableId = await createTable({ label: "Mesa de teste (deadlock)", sector: "Teste", capacity: 4 });
    createdTableIds.push(tableId);
    const session = await getOrOpenSessionForTable(tableId);
    createdSessionIds.push(session.id);

    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL configurada mas getDb() retornou null — checar conexão.");
    const fakePriced = {
      items: [{ product: { id: 999999, name: "Produto de teste (deadlock)" }, quantity: 1, note: undefined, addons: [], unitPriceCents: 1000, lineTotalCents: 1000 }],
      deliveryRoute: undefined,
      subtotalCents: 1000,
      deliveryFeeCents: 0,
      discountCents: 0,
      totalCents: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const { orderId } = await db.transaction(tx => insertPricedOrder({
      db: tx,
      priced: fakePriced,
      fulfillmentType: "DINE_IN",
      origin: "GARCOM",
      paymentMethod: "CASH",
      customerId: 999999,
      customerName: "Cliente de teste (deadlock)",
      customerPhone: "85999990000",
      now: Date.now(),
      tableSessionId: session.id,
    }));
    insertedOrderIds.push(orderId);

    // Zera o saldo da comanda pra que closeTableSession de fato CHEGUE na
    // escrita em `orders` (senão ela rejeitaria "conta não paga" logo depois
    // de travar a mesa, sem nunca disputar a linha do pedido de verdade) —
    // sem isso o teste não provaria nada sobre a disputa das duas tabelas.
    await recordBillPayment(session.id, { method: "CASH", amountCents: 1000 });

    const caller = adminOrdersRouter.createCaller(adminContext);

    const [closeResult, statusResult] = await Promise.allSettled([
      closeTableSession(session.id, null),
      caller.updateOrderStatus({ orderId, status: "ACCEPTED" }),
    ]);

    // A prova principal: nenhuma das duas rejeita com erro de deadlock do
    // MySQL. Se a ordem de aquisição de locks fosse inconsistente entre as
    // duas funções, o InnoDB formaria um ciclo e mataria uma delas com esse
    // erro em vez de só serializar uma atrás da outra.
    for (const outcome of [closeResult, statusResult]) {
      if (outcome.status === "rejected") {
        const reason = outcome.reason as { code?: string; errno?: number; message?: string; sqlMessage?: string };
        expect(reason.errno).not.toBe(1213);
        expect(String(reason.code ?? "")).not.toContain("DEADLOCK");
        expect(`${reason.message ?? ""} ${reason.sqlMessage ?? ""}`.toLowerCase()).not.toContain("deadlock");
      }
    }

    // As duas efetivamente progrediram (nenhuma travou o processo — se
    // tivesse deadlockado de verdade sem detecção, o teste estouraria o
    // timeout do vitest em vez de chegar aqui). Como updateOrderStatus
    // sempre relê a linha DEPOIS de travá-la (SELECT...FOR UPDATE no início
    // da própria transação), não existe "escrita perdida" possível entre as
    // duas nessa ordem de colunas (status vs. paymentStatus).
    expect(closeResult.status).toBe("fulfilled");
    expect(statusResult.status).toBe("fulfilled");

    const [finalOrder] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    expect(finalOrder?.status).toBe("ACCEPTED");
    expect(finalOrder?.paymentStatus).toBe("PAID");
  });
});
