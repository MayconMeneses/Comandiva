import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { orderChangeLogs, orderStatusHistory, orders, payments, printJobs } from "../drizzle/schema";

/**
 * Prova que updateOrderStatus/archiveOrder/markPaymentRefunded (server/routers/admin/orders.ts)
 * agora rodam suas múltiplas escritas dentro de db.transaction — antes eram
 * sequências soltas, então uma falha no meio (processo caindo, conexão
 * caindo) podia deixar orders/payments/order_status_history/print_jobs
 * inconsistentes entre si. Fortalecimento pré-offline (Fase 1) — qualquer
 * motor de sincronização futuro que reenviar esses mesmos comandos herdaria
 * o mesmo risco se isso não fosse corrigido primeiro.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getAdminOrders: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getFiscalDocumentByOrderId: vi.fn(),
  getRevenueTrend: vi.fn(),
  getStoreSettings: vi.fn(),
  emitNfceForOrder: vi.fn(),
  retryNfceForOrder: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getOrderWithDetails: mocks.getOrderWithDetails,
  getAdminOrders: mocks.getAdminOrders,
  getDashboardMetrics: mocks.getDashboardMetrics,
  getFiscalDocumentByOrderId: mocks.getFiscalDocumentByOrderId,
  getRevenueTrend: mocks.getRevenueTrend,
  getStoreSettings: mocks.getStoreSettings,
}));
vi.mock("./_core/nfceEmission", () => ({ emitNfceForOrder: mocks.emitNfceForOrder, retryNfceForOrder: mocks.retryNfceForOrder }));

import { adminOrdersRouter } from "./routers/admin/orders";

const adminContext = {
  user: { id: 1, openId: "admin", name: "Admin", email: "admin@mmsystemcreator.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

type Call = { kind: "update" | "insert"; table: unknown; payload: unknown };

/**
 * DB fake com transação real (invoca o callback com um `tx` espião) —
 * `failAtCall` (1-based, conta só update/insert) faz a N-ésima escrita
 * lançar ANTES de registrar o efeito, simulando queda no meio da sequência.
 */
function makeFakeDb(options: { currentOrder?: Record<string, unknown>; failAtCall?: number } = {}) {
  const calls: Call[] = [];
  let writeCount = 0;

  function queryable() {
    return {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => (options.currentOrder ? [options.currentOrder] : []) }) }) }),
      update: (table: unknown) => ({
        set: (payload: unknown) => ({
          where: async () => {
            writeCount += 1;
            if (options.failAtCall === writeCount) throw new Error(`falha simulada na escrita #${writeCount}`);
            calls.push({ kind: "update", table, payload });
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: async (payload: unknown) => {
          writeCount += 1;
          if (options.failAtCall === writeCount) throw new Error(`falha simulada na escrita #${writeCount}`);
          calls.push({ kind: "insert", table, payload });
          return [{ insertId: 1 }];
        },
      }),
    };
  }

  const db = {
    ...queryable(),
    transaction: async (fn: (tx: ReturnType<typeof queryable>) => Promise<unknown>) => fn(queryable()),
  };
  return { db, calls, getWriteCount: () => writeCount };
}

const BASE_ORDER = { id: 10, status: "PENDING", fulfillmentType: "DELIVERY", paymentMethod: "PIX", paymentStatus: "PENDING" };

describe("admin.updateOrderStatus — transação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caminho feliz: grava orders + order_status_history na mesma transação, sem quebrar nada", async () => {
    const stub = makeFakeDb({ currentOrder: BASE_ORDER });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getOrderWithDetails.mockResolvedValue({ ...BASE_ORDER, status: "ACCEPTED" });

    const caller = adminOrdersRouter.createCaller(adminContext);
    const result = await caller.updateOrderStatus({ orderId: 10, status: "ACCEPTED" });

    expect(result).toEqual({ ...BASE_ORDER, status: "ACCEPTED" });
    const kinds = stub.calls.map(call => ({ kind: call.kind, table: call.table }));
    expect(kinds).toEqual([
      { kind: "update", table: orders },
      { kind: "insert", table: orderStatusHistory },
      { kind: "insert", table: printJobs },
    ]);
    // getOrderWithDetails é chamado 2x no caminho feliz: 1) dentro da
    // transação, pra montar o payload do print job — recebe o `tx`, não
    // `undefined` (conexão própria), justamente o que garante que ele
    // enxergue o UPDATE de orders ainda não commitado (ver comentário em
    // server/db/orders.ts); 2) depois do commit, pra montar o retorno final
    // — sem `tx`, conexão nova de propósito.
    expect(mocks.getOrderWithDetails).toHaveBeenCalledTimes(2);
    const [firstOrderId, firstTx] = mocks.getOrderWithDetails.mock.calls[0] as [number, unknown];
    expect(firstOrderId).toBe(10);
    expect(firstTx).not.toBeUndefined();
    expect(firstTx).not.toBe(stub.db);
    const [finalOrderId, finalTx] = mocks.getOrderWithDetails.mock.calls[1] as [number, unknown];
    expect(finalOrderId).toBe(10);
    expect(finalTx).toBeUndefined();
  });

  it("transição pra COMPLETED (delivery) também atualiza payments, tudo na mesma transação", async () => {
    const stub = makeFakeDb({ currentOrder: { ...BASE_ORDER, status: "OUT_FOR_DELIVERY" } });
    mocks.getDb.mockResolvedValue(stub.db);

    const caller = adminOrdersRouter.createCaller(adminContext);
    await caller.updateOrderStatus({ orderId: 10, status: "COMPLETED" });

    const kinds = stub.calls.map(call => ({ kind: call.kind, table: call.table }));
    expect(kinds).toEqual([
      { kind: "update", table: orders },
      { kind: "update", table: payments },
      { kind: "insert", table: orderStatusHistory },
    ]);
  });

  it("falha no meio da sequência (ex.: INSERT print_jobs) rejeita a mutation inteira e não chega nos efeitos pós-transação", async () => {
    // 3 escritas esperadas pra ACCEPTED: update orders (1), insert
    // order_status_history (2), insert print_jobs (3) — derruba a 3ª.
    const stub = makeFakeDb({ currentOrder: BASE_ORDER, failAtCall: 3 });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getOrderWithDetails.mockResolvedValue({ ...BASE_ORDER, status: "ACCEPTED" });

    const caller = adminOrdersRouter.createCaller(adminContext);
    await expect(caller.updateOrderStatus({ orderId: 10, status: "ACCEPTED" })).rejects.toThrow("falha simulada");

    // As 2 escritas anteriores "aconteceram" na simulação, mas a função
    // nunca retornou sucesso nem chamou o getOrderWithDetails FINAL (o de
    // fora da transação, linha 187) — só o interno (linha ~175), que já
    // tinha rodado antes da 3ª escrita falhar.
    expect(mocks.getOrderWithDetails).toHaveBeenCalledTimes(1);
  });

  it("rejeita transição ilegal antes mesmo de abrir a transação (validação já existente, sem regressão)", async () => {
    const stub = makeFakeDb({ currentOrder: { ...BASE_ORDER, status: "COMPLETED" } });
    mocks.getDb.mockResolvedValue(stub.db);

    const caller = adminOrdersRouter.createCaller(adminContext);
    await expect(caller.updateOrderStatus({ orderId: 10, status: "ACCEPTED" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(stub.calls).toHaveLength(0);
  });
});

describe("admin.archiveOrder — transação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caminho feliz: UPDATE orders + INSERT order_change_logs juntos", async () => {
    const stub = makeFakeDb({ currentOrder: { ...BASE_ORDER, status: "COMPLETED", archivedAt: null } });
    mocks.getDb.mockResolvedValue(stub.db);

    const caller = adminOrdersRouter.createCaller(adminContext);
    const result = await caller.archiveOrder({ orderId: 10 });

    expect(result).toEqual({ success: true });
    expect(stub.calls.map(call => ({ kind: call.kind, table: call.table }))).toEqual([
      { kind: "update", table: orders },
      { kind: "insert", table: orderChangeLogs },
    ]);
  });

  it("falha na 2ª escrita (log) rejeita e não retorna sucesso", async () => {
    const stub = makeFakeDb({ currentOrder: { ...BASE_ORDER, status: "COMPLETED", archivedAt: null }, failAtCall: 2 });
    mocks.getDb.mockResolvedValue(stub.db);

    const caller = adminOrdersRouter.createCaller(adminContext);
    await expect(caller.archiveOrder({ orderId: 10 })).rejects.toThrow("falha simulada");
  });
});

describe("admin.markPaymentRefunded — transação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("caminho feliz: UPDATE payments + INSERT order_change_logs juntos", async () => {
    const stub = makeFakeDb({ currentOrder: BASE_ORDER });
    // markPaymentRefunded faz um select próprio em `payments` (não em
    // `currentOrder`) — o fake genérico devolve [] por padrão pra esse
    // select, então precisamos de um fake dedicado com o pagamento certo.
    stub.db.select = () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 5, orderId: 10, status: "PAID", amountCents: 5000 }] }) }) }) as never;
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getOrderWithDetails.mockResolvedValue({ ...BASE_ORDER, paymentStatus: "REFUNDED" });

    const caller = adminOrdersRouter.createCaller(adminContext);
    const result = await caller.markPaymentRefunded({ orderId: 10, reason: "Cliente desistiu" });

    expect(result).toEqual({ ...BASE_ORDER, paymentStatus: "REFUNDED" });
    expect(stub.calls.map(call => ({ kind: call.kind, table: call.table }))).toEqual([
      { kind: "update", table: payments },
      { kind: "insert", table: orderChangeLogs },
    ]);
  });
});
