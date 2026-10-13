import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado M3 da auditoria: assignPlan (troca manual de plano pelo Painel
 * Master) trocava o planId local mas nunca sincronizava o valor cobrado de
 * verdade no Mercado Pago — restaurante ficava com acesso ao plano novo
 * enquanto a cobrança automática continuava no valor do plano antigo, sem
 * nenhum aviso. Prova que a correção chama updateSubscriptionPreapproval com
 * o preço do plano novo quando existe preapproval ativa, e que uma falha
 * nessa chamada dispara alerta em vez de sumir silenciosamente.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getPlanByKey: vi.fn(),
  updateSubscriptionPreapproval: vi.fn(),
  alertSystemError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db/client", () => ({ getDb: mocks.getDb }));
vi.mock("./db/plans", () => ({ getPlanByKey: mocks.getPlanByKey }));
vi.mock("./_core/mercadoPagoBilling", () => ({ updateSubscriptionPreapproval: mocks.updateSubscriptionPreapproval, createSubscriptionPreapproval: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", commercialSiteUrl: "https://mmsystem.tech" } }));
vi.mock("./_core/telegramService", () => ({
  alertSystemError: mocks.alertSystemError,
  buildSubscriptionCanceledMessage: vi.fn(),
  buildSubscriptionPastDueGraceExpiredMessage: vi.fn(),
  buildSubscriptionPastDueMessage: vi.fn(),
  buildSubscriptionRecoveredMessage: vi.fn(),
  buildSubscriptionRenewedMessage: vi.fn(),
  sendTelegramMessageAsync: vi.fn(),
}));
vi.mock("./_core/emailService", () => ({ sendEmailAsync: vi.fn() }));

import { assignPlan } from "./db/subscriptions";

const SUBSCRIPTION = { id: 5, restaurantId: 2, planId: 1, gatewaySubscriptionId: "pre-abc", currentPeriodEnd: Date.now() + 1_000_000 };
const CURRENT_PLAN = { id: 1, key: "essencial", priceCents: 14990 };
const NEXT_PLAN = { id: 2, key: "profissional", priceCents: 24990 };

function dbStub() {
  const updateSet = vi.fn(() => ({ where: vi.fn() }));
  const insertValues = vi.fn();
  return {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => [{ subscription: SUBSCRIPTION, plan: CURRENT_PLAN }] }) }) }) }),
    update: () => ({ set: updateSet }),
    insert: () => ({ values: insertValues }),
    updateSet,
    insertValues,
  };
}

describe("assignPlan — sincroniza a preapproval do Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlanByKey.mockResolvedValue(NEXT_PLAN);
    mocks.updateSubscriptionPreapproval.mockResolvedValue(undefined);
  });

  it("com preapproval ativa, chama updateSubscriptionPreapproval com o preço do plano novo", async () => {
    const db = dbStub();
    mocks.getDb.mockResolvedValue(db);

    await assignPlan({ restaurantId: 2, planKey: "profissional", actor: "platform_admin:teste" });

    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-abc", amountCents: NEXT_PLAN.priceCents });
    expect(db.updateSet).toHaveBeenCalledWith(expect.objectContaining({ planId: NEXT_PLAN.id }));
  });

  it("se a sincronização com o Mercado Pago falhar, dispara alerta (não some silenciosamente) mas ainda aplica o plano local", async () => {
    const db = dbStub();
    mocks.getDb.mockResolvedValue(db);
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("timeout Mercado Pago"));

    const result = await assignPlan({ restaurantId: 2, planKey: "profissional", actor: "platform_admin:teste" });

    expect(result).toEqual({ success: true });
    expect(db.updateSet).toHaveBeenCalledWith(expect.objectContaining({ planId: NEXT_PLAN.id }));
    expect(mocks.alertSystemError).toHaveBeenCalledWith(expect.stringContaining("Falha ao atualizar valor da preapproval"), expect.stringContaining("timeout Mercado Pago"), expect.any(String), expect.any(String));
  });
});
