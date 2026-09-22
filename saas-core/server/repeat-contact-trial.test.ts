import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o gap apontado diretamente pelo usuário: cancelar e cadastrar de
 * novo com o mesmo e-mail/telefone dava um teste grátis de 30 dias novo,
 * indefinidamente. hasRestaurantForContact (qualquer status, inclusive
 * cancelado/encerrado) + grantTrial:false em createRestaurantWithSubscription
 * fecham essa lacuna — só no cadastro público (confirmSignupPaymentAndCreateRestaurant),
 * nunca na criação manual via Painel Master/CLI.
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttlMs: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./_core/apiKey", () => ({ generateApiKey: () => ({ apiKey: "rk_live_test", apiKeyHash: "hash", apiKeyPrefix: "rk_live_te" }), hashApiKey: (key: string) => `hashed:${key}` }));

import { plans, restaurants, subscriptionEvents, subscriptions } from "../drizzle/schema";
import { createRestaurantWithSubscription, hasRestaurantForContact } from "./db/restaurants";

const PLAN_ESSENCIAL = { id: 1, key: "essencial", name: "Essencial", priceCents: 9999, position: 1 };

function makeChain(rows: unknown[]) {
  const chain = {
    where: () => chain,
    limit: async () => rows,
    then: (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

describe("hasRestaurantForContact", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem nenhum restaurante cadastrado com esse contato: false", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => makeChain([]) }) });
    await expect(hasRestaurantForContact("novo@teste.com", "11999999999")).resolves.toBe(false);
  });

  it("e-mail já usado por um restaurante CANCELADO: true (qualquer status conta, não só ativo)", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => makeChain([{ id: 7, contactEmail: "dono@teste.com", contactPhone: "11988887777" }]) }) });
    await expect(hasRestaurantForContact("dono@teste.com", "11000000000")).resolves.toBe(true);
  });

  it("comparação de e-mail é case-insensitive", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => makeChain([{ id: 7, contactEmail: "Dono@Teste.com", contactPhone: null }]) }) });
    await expect(hasRestaurantForContact("dono@TESTE.COM", undefined)).resolves.toBe(true);
  });

  it("telefone já usado (e-mail diferente): true", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => makeChain([{ id: 7, contactEmail: "outro@teste.com", contactPhone: "11988887777" }]) }) });
    await expect(hasRestaurantForContact("novo@teste.com", "11988887777")).resolves.toBe(true);
  });

  it("sem e-mail nem telefone informado: false, sem nem consultar o banco", async () => {
    await expect(hasRestaurantForContact(undefined, undefined)).resolves.toBe(false);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});

describe("createRestaurantWithSubscription — grantTrial", () => {
  beforeEach(() => vi.clearAllMocks());

  function dbStub() {
    const insertedSubscriptions: Array<Record<string, unknown>> = [];
    const insertedEvents: Array<Record<string, unknown>> = [];
    const db = {
      select: () => ({ from: (table: unknown) => (table === plans ? makeChain([PLAN_ESSENCIAL]) : makeChain([])) }),
      insert: (table: unknown) => ({
        values: async (values: Record<string, unknown>) => {
          if (table === restaurants) return [{ insertId: 100 }];
          if (table === subscriptions) {
            insertedSubscriptions.push(values);
            return [{ insertId: 200 }];
          }
          if (table === subscriptionEvents) insertedEvents.push(values);
          return [{ insertId: 1 }];
        },
      }),
    };
    return { db, insertedSubscriptions, insertedEvents };
  }

  it("grantTrial omitido (default): assinatura nasce em 'trial', evento 'created'", async () => {
    const stub = dbStub();
    mocks.getDb.mockResolvedValue(stub.db);

    const result = await createRestaurantWithSubscription({ name: "Restaurante Novo", planKey: "essencial", contactEmail: "novo@teste.com" });

    expect(result.status).toBe("trial");
    expect(stub.insertedSubscriptions[0]).toMatchObject({ status: "trial" });
    expect(stub.insertedEvents[0]).toMatchObject({ eventType: "created" });
  });

  it("grantTrial:false (contato repetido): assinatura nasce em 'ended', evento 'created_no_trial_repeat_contact'", async () => {
    const stub = dbStub();
    mocks.getDb.mockResolvedValue(stub.db);

    const result = await createRestaurantWithSubscription({ name: "Restaurante Repetido", planKey: "essencial", contactEmail: "dono@teste.com", grantTrial: false });

    expect(result.status).toBe("ended");
    expect(stub.insertedSubscriptions[0]).toMatchObject({ status: "ended" });
    expect(stub.insertedEvents[0]).toMatchObject({ eventType: "created_no_trial_repeat_contact" });
  });
});
