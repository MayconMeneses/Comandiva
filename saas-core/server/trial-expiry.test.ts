import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o gap identificado na auditoria de cobrança recorrente: um trial que
 * vence sem nenhum checkout iniciado ficava com acesso completo pra sempre,
 * porque nada reavaliava esse estado (applyDueScheduledChanges não tinha
 * branch pra status 'trial'). Ver server/db/subscriptions.ts.
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
// cached: passthrough (sem memoização de verdade) — evita que o cache real (30s de TTL,
// num closure só por módulo) vaze estado entre testes.
vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttlMs: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./_core/env", () => ({ ENV: { mercadoPagoAccessToken: "", internalDemoRestaurantIds: [] } }));

import { features, planFeatures, planLimits, plans, subscriptions } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { applyDueScheduledChanges, computeSnapshotForRestaurant } from "./db/subscriptions";

const PLAN_ESSENCIAL = { id: 1, key: "essencial", name: "Essencial", priceCents: 9999, position: 1 };
const PLAN_PRO = { id: 2, key: "profissional", name: "Profissional", priceCents: 19999, position: 2 };
const ALL_PLANS = [PLAN_ESSENCIAL, PLAN_PRO];
const ALL_FEATURES = [{ featureId: "tables_qr", name: "Mesas/QR" }, { featureId: "audit", name: "Auditoria" }];
// Só o Profissional libera as duas — usado pra provar que o bloqueio zera o
// acesso mesmo quando o plano da assinatura tinha features de verdade.
const ALL_PLAN_FEATURES = [{ planId: PLAN_PRO.id, featureId: "tables_qr" }, { planId: PLAN_PRO.id, featureId: "audit" }];

function makeChain(rows: unknown[]) {
  const chain = {
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (value: unknown[]) => void, reject?: (reason: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function buildSnapshotDbStub(subscriptionRow: Record<string, unknown>) {
  let current = { ...subscriptionRow };
  const updateCalls: Array<Record<string, unknown>> = [];
  const insertCalls: Array<Record<string, unknown>> = [];
  const db = {
    select(fields?: unknown) {
      const isJoinShape = Boolean(fields && typeof fields === "object" && "subscription" in (fields as object));
      return {
        from(table: unknown) {
          if (isJoinShape) {
            const plan = ALL_PLANS.find(candidate => candidate.id === current.planId);
            return makeChain([{ subscription: current, plan }]);
          }
          if (table === subscriptions) return makeChain([current]);
          if (table === plans) return makeChain(ALL_PLANS);
          if (table === features) return makeChain(ALL_FEATURES);
          if (table === planFeatures) return makeChain(ALL_PLAN_FEATURES);
          if (table === planLimits) return makeChain([]);
          return makeChain([]);
        },
      };
    },
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updateCalls.push(values);
          current = { ...current, ...values };
        },
      }),
    }),
    insert: () => ({ values: async (values: Record<string, unknown>) => { insertCalls.push(values); } }),
  };
  return { db, updateCalls, insertCalls, getCurrent: () => current };
}

describe("applyDueScheduledChanges — trial vencido", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { ENV.internalDemoRestaurantIds = []; });

  it("restaurante de uso interno (ENV.internalDemoRestaurantIds): renova o período em vez de virar 'ended'", async () => {
    ENV.internalDemoRestaurantIds = [7];
    const previousEnd = Date.now() - 1000;
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_ESSENCIAL.id, status: "trial", currentPeriodEnd: previousEnd, scheduledPlanId: null, gatewaySubscriptionId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    await applyDueScheduledChanges(10);

    expect(stub.getCurrent().status).toBe("trial");
    expect(stub.getCurrent().currentPeriodEnd).toBeGreaterThan(previousEnd);
    expect(stub.insertCalls.some(event => event.eventType === "trial_ended")).toBe(false);
    expect(stub.insertCalls.some(event => event.eventType === "trial_renewed_internal_demo")).toBe(true);
  });

  it("trial vencido sem checkout iniciado (sem scheduledPlanId): vira 'ended' e grava evento de auditoria", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_ESSENCIAL.id, status: "trial", currentPeriodEnd: Date.now() - 1000, scheduledPlanId: null, gatewaySubscriptionId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    await applyDueScheduledChanges(10);

    expect(stub.getCurrent().status).toBe("ended");
    expect(stub.insertCalls).toHaveLength(1);
    expect(stub.insertCalls[0]).toMatchObject({ eventType: "trial_ended" });
  });

  it("trial ainda dentro do período: não faz nada", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_ESSENCIAL.id, status: "trial", currentPeriodEnd: Date.now() + 100_000, scheduledPlanId: null, gatewaySubscriptionId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    await applyDueScheduledChanges(10);

    expect(stub.getCurrent().status).toBe("trial");
    expect(stub.updateCalls).toHaveLength(0);
  });

  it("trial vencido MAS com checkout em andamento (scheduledPlanId setado): não marca como 'ended' — deixa o fluxo normal de assinatura seguir", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_ESSENCIAL.id, status: "trial", currentPeriodEnd: Date.now() - 1000, scheduledPlanId: PLAN_PRO.id, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);

    await applyDueScheduledChanges(10);

    expect(stub.getCurrent().status).not.toBe("ended");
    expect(stub.insertCalls.some(event => event.eventType === "trial_ended")).toBe(false);
  });
});

describe("computeSnapshotForRestaurant — bloqueio de acesso com trial 'ended'", () => {
  beforeEach(() => vi.clearAllMocks());

  it("status 'ended': zera features e bloqueia todas (mesmo as do plano Profissional)", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "ended", currentPeriodEnd: Date.now() - 500_000, scheduledPlanId: null, gatewaySubscriptionId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    const snapshot = await computeSnapshotForRestaurant(7);

    expect(snapshot.status).toBe("ended");
    expect(snapshot.features).toEqual([]);
    expect(Object.keys(snapshot.lockedFeatures)).toEqual(expect.arrayContaining(["tables_qr", "audit"]));
  });

  it("status 'active': features do plano continuam liberadas normalmente (comportamento existente, sem regressão)", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "active", currentPeriodEnd: Date.now() + 500_000, scheduledPlanId: null, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);

    const snapshot = await computeSnapshotForRestaurant(7);

    expect(snapshot.features).toEqual(expect.arrayContaining(["tables_qr", "audit"]));
    expect(snapshot.lockedFeatures).toEqual({});
  });

  it("trial vencido é reavaliado NA HORA da chamada — snapshot já reflete o bloqueio no mesmo request que cruza o vencimento", async () => {
    const stub = buildSnapshotDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "trial", currentPeriodEnd: Date.now() - 1000, scheduledPlanId: null, gatewaySubscriptionId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    const snapshot = await computeSnapshotForRestaurant(7);

    expect(snapshot.status).toBe("ended");
    expect(snapshot.features).toEqual([]);
  });
});
