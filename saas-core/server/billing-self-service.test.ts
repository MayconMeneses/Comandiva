import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fluxo self-service de troca de plano (server/db/subscriptions.ts) — os
 * cenários obrigatórios do prompt de billing: upgrade aplica na hora,
 * downgrade agenda pro fim do ciclo, primeira assinatura só muda o plano
 * depois do webhook confirmar (nunca antes), e nada é aplicado duas vezes.
 * Preço nunca é um input de nenhuma dessas funções — só planKey — então
 * "usuário manipulando preço" é estruturalmente impossível aqui, não
 * precisa de teste específico pra isso além de conferir a assinatura da função.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSubscriptionPreapproval: vi.fn(),
  updateSubscriptionPreapproval: vi.fn(),
  getPlanByKey: vi.fn(),
  mercadoPagoAccessToken: "TEST-token",
}));

vi.mock("./db/client", () => ({ getDb: mocks.getDb }));
vi.mock("./db/plans", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/plans")>();
  return { ...actual, getPlanByKey: mocks.getPlanByKey };
});
vi.mock("./_core/mercadoPagoBilling", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/mercadoPagoBilling")>();
  return { ...actual, createSubscriptionPreapproval: mocks.createSubscriptionPreapproval, updateSubscriptionPreapproval: mocks.updateSubscriptionPreapproval };
});
vi.mock("./_core/env", () => ({ ENV: { get mercadoPagoAccessToken() { return mocks.mercadoPagoAccessToken; } } }));

import { plans, subscriptions } from "../drizzle/schema";
import { applyDueScheduledChanges, startOrChangePlan } from "./db/subscriptions";

const PLAN_BASICO = { id: 1, key: "essencial", name: "Essencial", priceCents: 14990, position: 1 };
const PLAN_PRO = { id: 2, key: "profissional", name: "Profissional", priceCents: 24990, position: 2 };
const ALL_PLANS = [PLAN_BASICO, PLAN_PRO];

/** Mock de banco: distingue subscriptions×plans pelo join (getSubscriptionForRestaurant sempre pede {subscription, plan}) vs select simples (usado só por applyDueScheduledChanges pra buscar o plano AGENDADO por id). */
function buildDbStub(subscriptionRow: Record<string, unknown> | undefined) {
  let currentSubscription = subscriptionRow ? { ...subscriptionRow } : undefined;
  // Capturado ANTES de qualquer mutação — a busca por "qual plano tem este id"
  // (usada só pra reconsultar o preço na hora de atualizar a preapproval) se
  // refere sempre ao plano agendado ORIGINAL, mesmo depois do scheduledPlanId
  // já ter sido zerado pela própria applyDueScheduledChanges nesse meio-tempo.
  const originalScheduledPlanId = subscriptionRow?.scheduledPlanId as number | null | undefined;
  const updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];

  const db = {
    select(fields?: unknown) {
      const isJoinShape = Boolean(fields && typeof fields === "object" && "subscription" in (fields as object));
      return {
        from(table: unknown) {
          const chain = {
            innerJoin: () => chain,
            where: () => chain,
            orderBy: () => chain,
            limit: async () => {
              if (isJoinShape) {
                if (!currentSubscription) return [];
                const plan = ALL_PLANS.find(candidate => candidate.id === currentSubscription!.planId);
                return [{ subscription: currentSubscription, plan }];
              }
              if (table === subscriptions) {
                return currentSubscription ? [currentSubscription] : [];
              }
              if (table === plans && originalScheduledPlanId) {
                return ALL_PLANS.filter(plan => plan.id === originalScheduledPlanId);
              }
              return [];
            },
          };
          return chain;
        },
      };
    },
    update(table: unknown) {
      const tableName = table === subscriptions ? "subscriptions" : "unknown";
      return {
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updateCalls.push({ table: tableName, values });
            if (tableName === "subscriptions" && currentSubscription) currentSubscription = { ...currentSubscription, ...values };
          },
        }),
      };
    },
    insert() {
      return { values: async () => {} };
    },
  };
  return { db, updateCalls, getCurrent: () => currentSubscription };
}

describe("startOrChangePlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("primeira assinatura (sem gatewaySubscriptionId): cria checkout e agenda o plano — NÃO muda planId ainda", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_BASICO.id, status: "trial", currentPeriodEnd: Date.now() + 1000, gatewaySubscriptionId: null, scheduledPlanId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getPlanByKey.mockResolvedValue(PLAN_PRO);
    mocks.createSubscriptionPreapproval.mockResolvedValue({ id: "preapproval-123", initPoint: "https://mp.example/checkout/123", status: "pending" });

    const result = await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "dono@teste.com", backUrl: "https://pubx.exemplo.com/admin/plano", actor: "restaurant:7" });

    expect(result).toEqual({ checkoutUrl: "https://mp.example/checkout/123" });
    expect(mocks.createSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: PLAN_PRO.priceCents, payerEmail: "dono@teste.com" }));
    const finalState = stub.getCurrent();
    expect(finalState?.planId).toBe(PLAN_BASICO.id); // plano só muda quando o webhook confirmar, nunca aqui
    expect(finalState?.scheduledPlanId).toBe(PLAN_PRO.id);
  });

  it("assinatura ativa + upgrade: libera o plano NA HORA e atualiza o valor da preapproval existente", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_BASICO.id, status: "active", currentPeriodEnd: Date.now() + 1000, gatewaySubscriptionId: "pre-1", scheduledPlanId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getPlanByKey.mockResolvedValue(PLAN_PRO);

    const result = await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "dono@teste.com", backUrl: "https://x/admin/plano", actor: "restaurant:7" });

    expect(result).toEqual({ applied: true });
    expect(mocks.createSubscriptionPreapproval).not.toHaveBeenCalled(); // já tem assinatura — não cria outra
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ preapprovalId: "pre-1", amountCents: PLAN_PRO.priceCents }));
    expect(stub.getCurrent()?.planId).toBe(PLAN_PRO.id);
  });

  it("assinatura ativa + downgrade: AGENDA pro fim do ciclo, não muda o plano nem a preapproval agora", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "active", currentPeriodEnd: Date.now() + 1000, gatewaySubscriptionId: "pre-1", scheduledPlanId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getPlanByKey.mockResolvedValue(PLAN_BASICO);

    const result = await startOrChangePlan({ restaurantId: 7, planKey: "essencial", payerEmail: "dono@teste.com", backUrl: "https://x/admin/plano", actor: "restaurant:7" });

    expect(result).toMatchObject({ scheduled: true, planKey: "essencial" });
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled(); // valor só muda quando o downgrade se efetivar de verdade
    const finalState = stub.getCurrent();
    expect(finalState?.planId).toBe(PLAN_PRO.id); // plano atual continua valendo
    expect(finalState?.scheduledPlanId).toBe(PLAN_BASICO.id);
  });

  it("escolher o próprio plano atual de novo cancela um downgrade agendado, sem chamar o Mercado Pago", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "active", currentPeriodEnd: Date.now() + 1000, gatewaySubscriptionId: "pre-1", scheduledPlanId: PLAN_BASICO.id });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getPlanByKey.mockResolvedValue(PLAN_PRO);

    const result = await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "dono@teste.com", backUrl: "https://x/admin/plano", actor: "restaurant:7" });

    expect(result).toEqual({ applied: true });
    expect(mocks.createSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(stub.getCurrent()?.scheduledPlanId).toBe(null);
  });
});

describe("applyDueScheduledChanges", () => {
  beforeEach(() => vi.clearAllMocks());

  it("não faz nada se o ciclo atual ainda não venceu", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "active", currentPeriodEnd: Date.now() + 100_000, scheduledPlanId: PLAN_BASICO.id, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);
    await applyDueScheduledChanges(10);
    expect(stub.updateCalls.length).toBe(0);
  });

  it("aplica o downgrade agendado quando o ciclo já venceu, sem tocar em outra coisa", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "active", currentPeriodEnd: Date.now() - 1000, scheduledPlanId: PLAN_BASICO.id, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockResolvedValue(undefined);
    await applyDueScheduledChanges(10);
    const finalState = stub.getCurrent();
    expect(finalState?.planId).toBe(PLAN_BASICO.id);
    expect(finalState?.scheduledPlanId).toBe(null);
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ preapprovalId: "pre-1", amountCents: PLAN_BASICO.priceCents }));
  });

  it("finaliza cancelamento agendado quando o ciclo já venceu", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_PRO.id, status: "cancel_at_period_end", currentPeriodEnd: Date.now() - 1000, scheduledPlanId: null, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockResolvedValue(undefined);
    await applyDueScheduledChanges(10);
    const finalState = stub.getCurrent();
    expect(finalState?.status).toBe("canceled");
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ preapprovalId: "pre-1", status: "cancelled" }));
  });

  it("é idempotente — sem nada agendado e período ainda não vencido, não muda nada nem chama o Mercado Pago", async () => {
    const stub = buildDbStub({ id: 10, restaurantId: 7, planId: PLAN_BASICO.id, status: "active", currentPeriodEnd: Date.now() + 500_000, scheduledPlanId: null, gatewaySubscriptionId: "pre-1" });
    mocks.getDb.mockResolvedValue(stub.db);
    await applyDueScheduledChanges(10);
    expect(stub.updateCalls.length).toBe(0);
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
  });
});
