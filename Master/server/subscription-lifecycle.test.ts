import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ciclo de vida da assinatura no Master (server/db/subscriptions.ts): período
 * na ativação, rolagem em saltos, cancelamento/suspensão/reativação avisados
 * ao Mercado Pago, checkout duplicado, troca manual de plano e promoção na
 * troca de plano. Tudo com mocks: nenhum Mercado Pago, Telegram ou e-mail real.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createSubscriptionPreapproval: vi.fn(),
  updateSubscriptionPreapproval: vi.fn(),
  getSubscriptionPreapproval: vi.fn(),
  getPlanByKey: vi.fn(),
  alertSystemError: vi.fn(),
  token: "TEST-token",
}));

vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttlMs: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./db/plans", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/plans")>();
  return { ...actual, getPlanByKey: mocks.getPlanByKey };
});
vi.mock("./_core/mercadoPagoBilling", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/mercadoPagoBilling")>();
  return {
    ...actual,
    createSubscriptionPreapproval: mocks.createSubscriptionPreapproval,
    updateSubscriptionPreapproval: mocks.updateSubscriptionPreapproval,
    getSubscriptionPreapproval: mocks.getSubscriptionPreapproval,
  };
});
vi.mock("./_core/env", () => ({ ENV: { get mercadoPagoAccessToken() { return mocks.token; }, internalDemoRestaurantIds: [] }, commercialHomeUrl: "https://site.exemplo" }));
vi.mock("./_core/emailService", () => ({ sendEmailAsync: vi.fn() }));
vi.mock("./_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: vi.fn(), alertSystemError: mocks.alertSystemError };
});

import { plans, restaurants, subscriptions } from "../drizzle/schema";
import { applyDueScheduledChanges, applyPreapprovalStatus, assignPlan, reactivateScheduledCancellation, scheduleCancellation, startOrChangePlan, updateSubscriptionStatus } from "./db/subscriptions";

const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;
const PLAN_BASICO = { id: 1, key: "essencial", name: "Essencial", priceCents: 14990, position: 1 };
const PLAN_PRO = { id: 2, key: "profissional", name: "Profissional", priceCents: 24990, position: 2 };
const ALL_PLANS = [PLAN_BASICO, PLAN_PRO];

/** Banco falso mínimo: uma assinatura, planos fixos, registra updates e eventos. */
function buildDbStub(subscriptionRow: Record<string, unknown>) {
  let current = { ...subscriptionRow };
  const originalScheduledPlanId = subscriptionRow.scheduledPlanId as number | null | undefined;
  const updateCalls: Array<Record<string, unknown>> = [];
  const insertCalls: Array<Record<string, unknown>> = [];
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
              if (isJoinShape) return [{ subscription: current, plan: ALL_PLANS.find(plan => plan.id === current.planId) }];
              if (table === subscriptions) return [current];
              if (table === plans) return ALL_PLANS.filter(plan => plan.id === (originalScheduledPlanId || current.planId));
              if (table === restaurants) return [];
              return [];
            },
          };
          return chain;
        },
      };
    },
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updateCalls.push(values); current = { ...current, ...values }; } }) }),
    insert: () => ({ values: async (values: Record<string, unknown>) => { insertCalls.push(values); } }),
  };
  return { db, updateCalls, insertCalls, getCurrent: () => current };
}

const baseSub = (over: Record<string, unknown> = {}) => ({
  id: 10,
  restaurantId: 7,
  planId: PLAN_PRO.id,
  status: "active",
  currentPeriodStart: Date.now() - 10 * DAY,
  currentPeriodEnd: Date.now() + 20 * DAY,
  scheduledPlanId: null,
  gatewaySubscriptionId: "pre-1",
  gatewayCustomerId: null,
  promoDiscountCyclesRemaining: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "TEST-token";
  mocks.updateSubscriptionPreapproval.mockResolvedValue(undefined);
  mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized" });
  mocks.createSubscriptionPreapproval.mockResolvedValue({ id: "pre-nova", initPoint: "https://mp/checkout" });
  mocks.getPlanByKey.mockImplementation(async (key: string) => ALL_PLANS.find(plan => plan.key === key));
});

describe("1) período na ativação (applyPreapprovalStatus)", () => {
  it.each(["trial", "ended", "canceled", "payment_pending", "suspended"])("%s -> active: período recomeça agora (30 dias)", async status => {
    const stub = buildDbStub(baseSub({ status, currentPeriodStart: Date.now() - 90 * DAY, currentPeriodEnd: Date.now() - 60 * DAY }));
    mocks.getDb.mockResolvedValue(stub.db);
    const before = Date.now();
    await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized" });
    const after = Date.now();
    const updated = stub.updateCalls[0];
    expect(updated.status).toBe("active");
    expect(updated.currentPeriodStart as number).toBeGreaterThanOrEqual(before);
    expect(updated.currentPeriodStart as number).toBeLessThanOrEqual(after);
    expect(updated.currentPeriodEnd).toBe((updated.currentPeriodStart as number) + MONTH);
  });

  it("past_due -> active: NÃO reinicia o período (só limpa pastDueSince)", async () => {
    const stub = buildDbStub(baseSub({ status: "past_due", pastDueSince: Date.now() - DAY }));
    mocks.getDb.mockResolvedValue(stub.db);
    await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized" });
    const updated = stub.updateCalls[0];
    expect(updated.status).toBe("active");
    expect(updated.pastDueSince).toBe(null);
    expect(updated).not.toHaveProperty("currentPeriodEnd");
    expect(updated).not.toHaveProperty("currentPeriodStart");
  });

  it.each(["paused", "cancelled"])("cancel_at_period_end + webhook '%s' (eco do cancelamento do cliente): ignora, acesso segue até o fim do período", async mpStatus => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end" }));
    mocks.getDb.mockResolvedValue(stub.db);
    const result = await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus });
    expect(result).toEqual({ found: true, applied: false });
    expect(stub.updateCalls).toHaveLength(0);
  });

  it("cancel_at_period_end -> authorized (corrida no desfazer): vira active SEM reiniciar o período", async () => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end" }));
    const { currentPeriodStart, currentPeriodEnd } = stub.getCurrent();
    mocks.getDb.mockResolvedValue(stub.db);
    await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized" });
    expect(stub.updateCalls[0].status).toBe("active");
    expect(stub.getCurrent().currentPeriodStart).toBe(currentPeriodStart);
    expect(stub.getCurrent().currentPeriodEnd).toBe(currentPeriodEnd);
  });
});

describe("1) rolagem do período em saltos (applyDueScheduledChanges)", () => {
  it("fim vencido há menos de um mês: mantém a âncora (início = fim anterior)", async () => {
    const end = Date.now() - 10 * DAY;
    const stub = buildDbStub(baseSub({ currentPeriodEnd: end }));
    mocks.getDb.mockResolvedValue(stub.db);
    await applyDueScheduledChanges(10);
    expect(stub.getCurrent().currentPeriodStart).toBe(end);
    expect(stub.getCurrent().currentPeriodEnd).toBe(end + MONTH);
  });

  it("fim vencido há mais de um mês: recomeça de agora, sem recuperar meses", async () => {
    const stub = buildDbStub(baseSub({ currentPeriodEnd: Date.now() - 75 * DAY, promoDiscountCyclesRemaining: 2 }));
    mocks.getDb.mockResolvedValue(stub.db);
    const before = Date.now();
    await applyDueScheduledChanges(10);
    expect(stub.getCurrent().currentPeriodStart as number).toBeGreaterThanOrEqual(before);
    expect(stub.getCurrent().currentPeriodEnd as number).toBeGreaterThan(before + 29 * DAY);
    // um único ciclo rolou: o contador da promoção desce 1, não 2 ou 3
    expect(stub.getCurrent().promoDiscountCyclesRemaining).toBe(1);
  });

  it("downgrade agendado com fim vencido há mais de um mês: período também recomeça de agora", async () => {
    const stub = buildDbStub(baseSub({ currentPeriodEnd: Date.now() - 75 * DAY, scheduledPlanId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    const before = Date.now();
    await applyDueScheduledChanges(10);
    expect(stub.getCurrent().planId).toBe(PLAN_BASICO.id);
    expect(stub.getCurrent().currentPeriodStart as number).toBeGreaterThanOrEqual(before);
  });
});

describe("2) cancelamento pelo cliente (scheduleCancellation)", () => {
  it("PAUSA a cobrança no Mercado Pago NA HORA (antes de gravar) e mantém o acesso até o fim do período", async () => {
    const end = Date.now() + 15 * DAY;
    const stub = buildDbStub(baseSub({ currentPeriodEnd: end }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { expect(stub.updateCalls).toHaveLength(0); });
    const result = await scheduleCancellation({ restaurantId: 7, actor: "restaurant:7" });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-1", status: "paused" });
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(stub.getCurrent().status).toBe("cancel_at_period_end");
    expect(stub.getCurrent().currentPeriodEnd).toBe(end);
    expect(result).toEqual({ effectiveAt: end });
  });

  it("Mercado Pago recusa: não grava o cancelamento e devolve erro claro em pt-BR", async () => {
    const stub = buildDbStub(baseSub());
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("recusou"));
    await expect(scheduleCancellation({ restaurantId: 7, actor: "restaurant:7" })).rejects.toMatchObject({ message: expect.stringContaining("Seu cancelamento NÃO foi registrado") });
    expect(stub.updateCalls).toHaveLength(0);
    expect(stub.insertCalls).toHaveLength(0);
  });

  it("fim do período com preapproval já cancelada no Mercado Pago: finaliza sem repetir o PUT nem alertar", async () => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end", currentPeriodEnd: Date.now() - 1000 }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "cancelled" });
    await applyDueScheduledChanges(10);
    expect(stub.getCurrent().status).toBe("canceled");
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(mocks.alertSystemError).not.toHaveBeenCalled();
  });

  it("fim do período com a cobrança pausada no Mercado Pago: cancela de vez", async () => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end", currentPeriodEnd: Date.now() - 1000 }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "paused" });
    await applyDueScheduledChanges(10);
    expect(stub.getCurrent().status).toBe("canceled");
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-1", status: "cancelled" });
  });

  it("desfazer cancelamento: retoma a cobrança (authorized) e a assinatura volta a active", async () => {
    const end = Date.now() + 10 * DAY;
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end", currentPeriodEnd: end }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { expect(stub.updateCalls).toHaveLength(0); });
    await reactivateScheduledCancellation({ restaurantId: 7, actor: "restaurant:7" });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-1", status: "authorized" });
    expect(stub.getCurrent().status).toBe("active");
    expect(stub.getCurrent().currentPeriodEnd).toBe(end);
  });

  it("desfazer cancelamento: se o Mercado Pago recusar retomar, nada é gravado", async () => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end" }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("recusou"));
    await expect(reactivateScheduledCancellation({ restaurantId: 7, actor: "restaurant:7" })).rejects.toMatchObject({ message: expect.stringContaining("O cancelamento agendado continua valendo") });
    expect(stub.updateCalls).toHaveLength(0);
    expect(stub.getCurrent().status).toBe("cancel_at_period_end");
  });
});

describe("3) e 4) mudança manual de status no painel (updateSubscriptionStatus)", () => {
  it.each([
    ["canceled", "active", "cancelled"],
    ["suspended", "active", "paused"],
    ["active", "suspended", "authorized"],
  ])("-> %s (era %s): pede %s ao Mercado Pago ANTES de gravar", async (next, previous, mpStatus) => {
    const stub = buildDbStub(baseSub({ status: previous }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { expect(stub.updateCalls).toHaveLength(0); });
    await updateSubscriptionStatus({ restaurantId: 7, status: next as never });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ preapprovalId: "pre-1", status: mpStatus }));
    expect(stub.getCurrent().status).toBe(next);
  });

  it.each([
    ["canceled", "active"],
    ["suspended", "active"],
    ["active", "suspended"],
  ])("Mercado Pago recusa (-> %s): status local NÃO muda, erro claro", async (next, previous) => {
    const stub = buildDbStub(baseSub({ status: previous }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("recusou"));
    await expect(updateSubscriptionStatus({ restaurantId: 7, status: next as never })).rejects.toMatchObject({ code: "BAD_GATEWAY", message: expect.stringContaining("O status da assinatura NÃO foi alterado") });
    expect(stub.updateCalls).toHaveLength(0);
    expect(stub.insertCalls).toHaveLength(0);
  });

  it("canceled -> active (preapproval cancelada é definitiva) e assinatura sem gateway: não chamam o Mercado Pago", async () => {
    const cancelled = buildDbStub(baseSub({ status: "canceled" }));
    mocks.getDb.mockResolvedValue(cancelled.db);
    await updateSubscriptionStatus({ restaurantId: 7, status: "active" });
    const manual = buildDbStub(baseSub({ status: "active", gatewaySubscriptionId: null }));
    mocks.getDb.mockResolvedValue(manual.db);
    await updateSubscriptionStatus({ restaurantId: 7, status: "suspended" });
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(manual.getCurrent().status).toBe("suspended");
  });
});

describe("5) cobrança duplicada no checkout (startOrChangePlan)", () => {
  it("já existe preapproval: cancela a antiga ANTES de criar a nova", async () => {
    const stub = buildDbStub(baseSub({ status: "payment_pending", planId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    const order: string[] = [];
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { order.push("cancela-antiga"); });
    mocks.createSubscriptionPreapproval.mockImplementation(async () => { order.push("cria-nova"); return { id: "pre-nova", initPoint: "https://mp/checkout" }; });
    const result = await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "a@b.com", backUrl: "https://x.com", actor: "restaurant:7" });
    expect(order).toEqual(["cancela-antiga", "cria-nova"]);
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ preapprovalId: "pre-1", status: "cancelled" }));
    expect(result).toEqual({ checkoutUrl: "https://mp/checkout" });
    expect(stub.getCurrent().gatewaySubscriptionId).toBe("pre-nova");
  });

  it("falha ao cancelar a antiga: NÃO cria a nova e devolve erro claro", async () => {
    const stub = buildDbStub(baseSub({ status: "payment_pending", planId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("recusou"));
    await expect(startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "a@b.com", backUrl: "https://x.com", actor: "restaurant:7" })).rejects.toMatchObject({ message: expect.stringContaining("A mudança de plano NÃO foi iniciada") });
    expect(mocks.createSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(stub.updateCalls).toHaveLength(0);
  });

  it("antiga já cancelada no Mercado Pago: segue sem repetir o PUT", async () => {
    const stub = buildDbStub(baseSub({ status: "cancel_at_period_end", planId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "cancelled" });
    await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "a@b.com", backUrl: "https://x.com", actor: "restaurant:7" });
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(mocks.createSubscriptionPreapproval).toHaveBeenCalledTimes(1);
  });
});

describe("6) troca manual de plano (assignPlan)", () => {
  it("limpa o downgrade agendado junto com a troca", async () => {
    const stub = buildDbStub(baseSub({ planId: PLAN_BASICO.id, scheduledPlanId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    await assignPlan({ restaurantId: 7, planKey: "profissional" });
    expect(stub.updateCalls[0]).toMatchObject({ planId: PLAN_PRO.id, scheduledPlanId: null });
  });
});

describe("7) promoção na troca de plano", () => {
  it("upgrade com ciclos de promoção restantes: preapproval com 20% de desconto no plano novo", async () => {
    const stub = buildDbStub(baseSub({ planId: PLAN_BASICO.id, promoDiscountCyclesRemaining: 2 }));
    mocks.getDb.mockResolvedValue(stub.db);
    await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "a@b.com", backUrl: "https://x.com", actor: "restaurant:7" });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: Math.round(PLAN_PRO.priceCents * 0.8) }));
  });

  it("upgrade sem promoção restante: preço cheio", async () => {
    const stub = buildDbStub(baseSub({ planId: PLAN_BASICO.id, promoDiscountCyclesRemaining: null }));
    mocks.getDb.mockResolvedValue(stub.db);
    await startOrChangePlan({ restaurantId: 7, planKey: "profissional", payerEmail: "a@b.com", backUrl: "https://x.com", actor: "restaurant:7" });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: PLAN_PRO.priceCents }));
  });

  it("downgrade agendado aplicado com promoção restante: plano novo também com desconto", async () => {
    const stub = buildDbStub(baseSub({ currentPeriodEnd: Date.now() - 1000, scheduledPlanId: PLAN_BASICO.id, promoDiscountCyclesRemaining: 1 }));
    mocks.getDb.mockResolvedValue(stub.db);
    await applyDueScheduledChanges(10);
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: Math.round(PLAN_BASICO.priceCents * 0.8) }));
  });

  it("downgrade agendado aplicado sem promoção: preço cheio do plano novo", async () => {
    const stub = buildDbStub(baseSub({ currentPeriodEnd: Date.now() - 1000, scheduledPlanId: PLAN_BASICO.id }));
    mocks.getDb.mockResolvedValue(stub.db);
    await applyDueScheduledChanges(10);
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: PLAN_BASICO.priceCents }));
  });

  it("troca manual (assignPlan) durante a promoção também mantém o desconto", async () => {
    const stub = buildDbStub(baseSub({ planId: PLAN_BASICO.id, promoDiscountCyclesRemaining: 2 }));
    mocks.getDb.mockResolvedValue(stub.db);
    await assignPlan({ restaurantId: 7, planKey: "profissional" });
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ amountCents: Math.round(PLAN_PRO.priceCents * 0.8) }));
  });
});
