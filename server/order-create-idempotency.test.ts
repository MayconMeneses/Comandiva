import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { addonGroups, orders, payments, products } from "../drizzle/schema";

/**
 * Prova a parte de `order.create` que insertPricedOrder sozinho não cobre:
 * quando um resubmit com o mesmo `operationId` bate no caminho `isDuplicate`,
 * a transação NÃO tenta inserir uma segunda linha em `payments` pro mesmo
 * pedido (o que bateria em `payments_order_unique` e derrubaria a transação
 * com um erro cru — ver comentário em server/routers/order.ts). O
 * comportamento de baixo nível do ER_DUP_ENTRY dentro de uma transação MySQL
 * já é provado contra banco real em server/order-idempotency-real-db.test.ts;
 * aqui é só a lógica de aplicação (JS puro), por isso mock é suficiente.
 *
 * Ver plano: C:\Users\maico\.claude\plans\lovely-purring-dusk.md
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getStoreSettings: vi.fn(),
  saveCustomerProfile: vi.fn(),
  getActiveOrdersByPhone: vi.fn(),
  getOrderByTrackingCode: vi.fn(),
  savePixChargeForOrder: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { appRouter } from "./routers";

const publicContext = { user: null, req: { ip: "203.0.113.90", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

const BASE_INPUT = {
  items: [{ productId: 1, quantity: 1, addonOptionIds: [] }],
  fulfillmentType: "PICKUP" as const,
  paymentMethod: "CASH" as const,
  customer: { name: "Cliente Teste", phone: "85999991234" },
};

/**
 * `orderIdsByOperationId` simula a unique constraint de `clientOperationId`
 * em `orders` — mesmo raciocínio de dedup usado contra o banco real, só que
 * em memória: a segunda inserção com a mesma chave lança um erro no MESMO
 * formato que o drizzle-orm realmente lança (código em `error.cause.code`,
 * não em `error.code` direto — confirmado rodando contra MySQL de verdade
 * antes de escrever este mock).
 */
function makeFakeDb() {
  const orderIdsByOperationId = new Map<string, { id: number; publicCode: string }>();
  const paymentsInsertCalls: unknown[] = [];
  let nextOrderId = 1;

  function queryable() {
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === products) return { where: async () => [{ id: 1, name: "Produto Teste", priceCents: 1000, available: true }] };
          if (table === addonGroups) return { where: async () => [] };
          // Busca de dedup dentro do catch de ER_DUP_ENTRY (insertPricedOrder)
          // — devolve o pedido já existente pra aquele clientOperationId.
          if (table === orders) return { where: () => ({ limit: async () => [...orderIdsByOperationId.values()].slice(-1) }) };
          // Query de combos de promoção (join de 3 tabelas) — sem combo aplicável no teste.
          return { innerJoin: () => ({ innerJoin: () => ({ where: async () => [] }) }) };
        },
      }),
      insert: (table: unknown) => ({
        values: async (payload: Record<string, unknown>) => {
          if (table === orders) {
            const operationId = payload.clientOperationId as string | null;
            if (operationId && orderIdsByOperationId.has(operationId)) {
              const err = new Error("Duplicate entry") as Error & { cause?: { code: string } };
              err.cause = { code: "ER_DUP_ENTRY" };
              throw err;
            }
            const id = nextOrderId++;
            const publicCode = payload.publicCode as string;
            if (operationId) orderIdsByOperationId.set(operationId, { id, publicCode });
            return [{ insertId: id }];
          }
          if (table === payments) paymentsInsertCalls.push(payload);
          return [{ insertId: 1 }];
        },
      }),
    };
  }

  const db = {
    ...queryable(),
    transaction: async (fn: (tx: ReturnType<typeof queryable>) => Promise<unknown>) => fn(queryable()),
  };
  return { db, paymentsInsertCalls };
}

describe("order.create — idempotência (parte de aplicação, complementa o teste contra banco real)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreSettings.mockResolvedValue({ isAcceptingOrders: true, minimumOrderCents: 0, deliveryFeeCents: 0, estimatedDeliveryMin: 30, estimatedDeliveryMax: 50 });
    mocks.saveCustomerProfile.mockResolvedValue({ id: 1, name: "Cliente Teste", phone: "85999991234" });
  });

  it("resubmit com o mesmo operationId devolve o MESMO pedido e grava payments só uma vez", async () => {
    const { db, paymentsInsertCalls } = makeFakeDb();
    mocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(publicContext);
    const operationId = "test-op-resubmit-1";

    const first = await caller.order.create({ ...BASE_INPUT, operationId });
    const second = await caller.order.create({ ...BASE_INPUT, operationId });

    expect(second.orderId).toBe(first.orderId);
    expect(second.publicCode).toBe(first.publicCode);
    expect(paymentsInsertCalls).toHaveLength(1);
  });

  it("operationId diferente cria um pedido novo de verdade, com seu próprio payments", async () => {
    const { db, paymentsInsertCalls } = makeFakeDb();
    mocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(publicContext);

    const first = await caller.order.create({ ...BASE_INPUT, operationId: "test-op-a" });
    const second = await caller.order.create({ ...BASE_INPUT, operationId: "test-op-b" });

    expect(second.orderId).not.toBe(first.orderId);
    expect(paymentsInsertCalls).toHaveLength(2);
  });
});
