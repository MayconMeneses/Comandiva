import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * confirmSignupPaymentAndCreateRestaurant é o único ponto que transforma um
 * pagamento aprovado da taxa de implementação num restaurante de verdade —
 * o teste obrigatório aqui é a idempotência: o webhook do Mercado Pago pode
 * reenviar a mesma notificação, e isso nunca pode criar dois restaurantes
 * pro mesmo pagamento.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createRestaurantWithSubscription: vi.fn(),
  hasRestaurantForContact: vi.fn().mockResolvedValue(false),
  getSubscriptionForRestaurant: vi.fn(),
  recordPlatformAuditLog: vi.fn(),
}));

// cached: passthrough (sem memoização de verdade) — evita que o cache real (30s de TTL,
// num closure só por módulo) vaze estado entre testes.
vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttlMs: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./db/restaurants", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/restaurants")>();
  return { ...actual, createRestaurantWithSubscription: mocks.createRestaurantWithSubscription, hasRestaurantForContact: mocks.hasRestaurantForContact };
});
vi.mock("./db/subscriptions", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/subscriptions")>();
  return { ...actual, getSubscriptionForRestaurant: mocks.getSubscriptionForRestaurant };
});
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { confirmSignupPaymentAndCreateRestaurant } from "./db/signupPayments";

const PAYLOAD = { name: "Restaurante Teste", planKey: "essencial", contactEmail: "dono@teste.com" };

function buildDbStub(row: Record<string, unknown> | undefined) {
  let current = row ? { ...row } : undefined;
  const updateCalls: Array<Record<string, unknown>> = [];
  const insertCalls: Array<Record<string, unknown>> = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (current ? [current] : []),
        }),
        // hasRestaurantForContact (server/db/restaurants.ts) faz um select
        // sem where/limit, aguardado direto — sem nenhum restaurante
        // cadastrado neste stub (é um pagamento de cadastro, não um
        // restaurante), sempre resolve pra lista vazia = contato nunca visto antes.
        then: (resolve: (rows: unknown[]) => void) => Promise.resolve([]).then(resolve),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updateCalls.push(values);
          if (current) current = { ...current, ...values };
        },
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        insertCalls.push(values);
      },
    }),
  };
  return { db, updateCalls, insertCalls, getCurrent: () => current };
}

describe("confirmSignupPaymentAndCreateRestaurant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cria o restaurante na primeira confirmação de pagamento aprovado", async () => {
    const stub = buildDbStub({ id: 1, payload: PAYLOAD, status: "pending", amountCents: 75000, restaurantId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.createRestaurantWithSubscription.mockResolvedValue({ restaurantId: 42, apiKey: "rk_live_x", planKey: "essencial", status: "trial", deliveryDueAt: Date.now() });
    mocks.getSubscriptionForRestaurant.mockResolvedValue({ subscription: { id: 99 }, plan: { key: "essencial" } });

    const result = await confirmSignupPaymentAndCreateRestaurant(1, "mp-payment-abc");

    expect(result).toEqual({ found: true, alreadyProcessed: false, restaurantId: 42 });
    expect(mocks.createRestaurantWithSubscription).toHaveBeenCalledTimes(1);
    expect(stub.getCurrent()?.status).toBe("restaurant_created");
    expect(stub.getCurrent()?.restaurantId).toBe(42);
  });

  it("contato já teve restaurante antes (mesmo cancelado): cria o restaurante SEM conceder trial", async () => {
    const stub = buildDbStub({ id: 1, payload: PAYLOAD, status: "pending", amountCents: 75000, restaurantId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.hasRestaurantForContact.mockResolvedValueOnce(true);
    mocks.createRestaurantWithSubscription.mockResolvedValue({ restaurantId: 43, apiKey: "rk_live_y", planKey: "essencial", status: "ended", deliveryDueAt: Date.now() });
    mocks.getSubscriptionForRestaurant.mockResolvedValue({ subscription: { id: 98 }, plan: { key: "essencial" } });

    await confirmSignupPaymentAndCreateRestaurant(1, "mp-payment-def");

    expect(mocks.hasRestaurantForContact).toHaveBeenCalledWith(PAYLOAD.contactEmail, undefined);
    expect(mocks.createRestaurantWithSubscription).toHaveBeenCalledWith(expect.objectContaining({ grantTrial: false }));
  });

  it("é idempotente — processar o mesmo pagamento de novo não cria um segundo restaurante", async () => {
    const stub = buildDbStub({ id: 1, payload: PAYLOAD, status: "restaurant_created", amountCents: 75000, restaurantId: 42 });
    mocks.getDb.mockResolvedValue(stub.db);

    const result = await confirmSignupPaymentAndCreateRestaurant(1, "mp-payment-abc");

    expect(result).toEqual({ found: true, alreadyProcessed: true, restaurantId: 42 });
    expect(mocks.createRestaurantWithSubscription).not.toHaveBeenCalled();
  });

  it("pagamento sem linha correspondente: não lança, só devolve found=false", async () => {
    const stub = buildDbStub(undefined);
    mocks.getDb.mockResolvedValue(stub.db);

    const result = await confirmSignupPaymentAndCreateRestaurant(999, "mp-payment-xyz");

    expect(result).toEqual({ found: false });
    expect(mocks.createRestaurantWithSubscription).not.toHaveBeenCalled();
  });
});
