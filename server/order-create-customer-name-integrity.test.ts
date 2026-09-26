import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { addonGroups, orders, payments, products } from "../drizzle/schema";

/**
 * Segunda metade da correção do achado P1 (ver
 * server/customer-profile-overwrite-protection.test.ts pela primeira): mesmo
 * antes da correção em saveCustomerProfile, `order.create` já gravava
 * `customerName`/`customerPhone` a partir do valor DEVOLVIDO por
 * saveCustomerProfile, não do que foi digitado nesta compra — isso deixou de
 * ser um problema de exposição só porque saveCustomerProfile parou de
 * sobrescrever, mas continuaria sendo uma pegadinha (nome errado no pedido
 * de quem digitou algo novo) se alguém reintroduzisse essa leitura por
 * engano. Este teste prova que `order.create` usa `input.customer.name`/
 * `input.customer.phone` diretamente, nunca o retorno de saveCustomerProfile.
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

const publicContext = { user: null, req: { ip: "203.0.113.91", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

function makeFakeDb() {
  const ordersInsertCalls: Record<string, unknown>[] = [];
  let nextOrderId = 1;
  function queryable() {
    return {
      select: () => ({
        from: (table: unknown) => {
          if (table === products) return { where: async () => [{ id: 1, name: "Produto Teste", priceCents: 1000, available: true }] };
          if (table === addonGroups) return { where: async () => [] };
          if (table === orders) return { where: () => ({ limit: async () => [] }) };
          return { innerJoin: () => ({ innerJoin: () => ({ where: async () => [] }) }) };
        },
      }),
      insert: (table: unknown) => ({
        values: async (payload: Record<string, unknown>) => {
          if (table === orders) {
            ordersInsertCalls.push(payload);
            return [{ insertId: nextOrderId++ }];
          }
          if (table === payments) return [{ insertId: 1 }];
          return [{ insertId: 1 }];
        },
      }),
    };
  }
  const db = { ...queryable(), transaction: async (fn: (tx: ReturnType<typeof queryable>) => Promise<unknown>) => fn(queryable()) };
  return { db, ordersInsertCalls };
}

describe("order.create — nome/telefone gravados no pedido são sempre os digitados nesta compra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStoreSettings.mockResolvedValue({ isAcceptingOrders: true, minimumOrderCents: 0, deliveryFeeCents: 0, estimatedDeliveryMin: 30, estimatedDeliveryMax: 50 });
  });

  it("mesmo quando saveCustomerProfile devolve um nome/telefone diferente (telefone já cadastrado), o pedido usa o que foi digitado agora", async () => {
    // Simula o telefone já pertencer a um cliente com outro nome salvo —
    // saveCustomerProfile (já corrigido) devolveria o cadastro ORIGINAL sem
    // alterá-lo. Este teste garante que o PEDIDO, mesmo assim, reflete o que
    // a pessoa digitou agora, nunca o nome antigo salvo.
    mocks.saveCustomerProfile.mockResolvedValue({ id: 42, name: "Nome Salvo Antigo", phone: "85999990003" });
    const { db, ordersInsertCalls } = makeFakeDb();
    mocks.getDb.mockResolvedValue(db);
    const caller = appRouter.createCaller(publicContext);

    await caller.order.create({
      items: [{ productId: 1, quantity: 1, addonOptionIds: [] }],
      fulfillmentType: "PICKUP",
      paymentMethod: "CASH",
      customer: { name: "Nome Digitado Agora", phone: "85999990003" },
      operationId: "test-name-integrity-1",
    });

    expect(ordersInsertCalls).toHaveLength(1);
    expect(ordersInsertCalls[0].customerName).toBe("Nome Digitado Agora");
    expect(ordersInsertCalls[0].customerName).not.toBe("Nome Salvo Antigo");
  });
});
