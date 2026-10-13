import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prova que uma falha real (não os retornos 200 esperados) nos dois webhooks
 * de pagamento do saas-core — cobrança da mensalidade (mercadoPagoWebhook.ts)
 * e taxa de implementação (mercadoPagoSignupWebhook.ts) — dispara
 * alertSystemError, em vez de só sumir no console. A lógica de negócio de
 * cada um (idempotência, mapeamento de status) já tem cobertura própria em
 * billing.test.ts/signupPayments.test.ts; aqui o foco é só o catch.
 */
const mocks = vi.hoisted(() => ({
  alertSystemError: vi.fn(),
  getSubscriptionPreapproval: vi.fn(),
  getAuthorizedPayment: vi.fn(),
  getPayment: vi.fn(),
  markWebhookEventOnce: vi.fn(),
  unmarkWebhookEvent: vi.fn(),
  applyPreapprovalStatus: vi.fn(),
}));

vi.mock("./telegramService", () => ({ alertSystemError: mocks.alertSystemError }));
vi.mock("./env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", mercadoPagoWebhookSecret: "segredo-de-teste" } }));
vi.mock("./mercadoPagoBilling", () => ({
  getSubscriptionPreapproval: mocks.getSubscriptionPreapproval,
  getAuthorizedPayment: mocks.getAuthorizedPayment,
  verifyMercadoPagoWebhookSignature: vi.fn(() => true),
}));
vi.mock("./mercadoPagoCheckout", () => ({ getPayment: mocks.getPayment }));
vi.mock("../db/webhookEvents", () => ({ markWebhookEventOnce: mocks.markWebhookEventOnce, unmarkWebhookEvent: mocks.unmarkWebhookEvent }));
vi.mock("../db/subscriptions", () => ({
  applyDueScheduledChanges: vi.fn(),
  applyPreapprovalStatus: mocks.applyPreapprovalStatus,
  getSubscriptionByGatewaySubscriptionId: vi.fn(),
  markSubscriptionPastDue: vi.fn(),
  notifySubscriptionRenewed: vi.fn(),
  recordBillingPayment: vi.fn(),
}));
vi.mock("../db/signupPayments", () => ({ confirmSignupPaymentAndCreateRestaurant: vi.fn() }));

const { handleMercadoPagoBillingWebhook } = await import("./mercadoPagoWebhook");
const { handleMercadoPagoSignupWebhook } = await import("./mercadoPagoSignupWebhook");

function fakeReqRes(body: unknown) {
  let statusCode: number | undefined;
  let jsonBody: unknown;
  const req = { body, query: {}, header: () => undefined } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { jsonBody = payload; return this; },
  } as unknown as Response;
  return { req, res, getResult: () => ({ statusCode, jsonBody }) };
}

describe("handleMercadoPagoBillingWebhook — alerta em falha real", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falha ao consultar a preapproval (ex.: Mercado Pago fora do ar) dispara alerta com área da cobrança", async () => {
    mocks.getSubscriptionPreapproval.mockRejectedValue(new Error("timeout consultando Mercado Pago"));
    const { req, res, getResult } = fakeReqRes({ type: "subscription_preapproval", data: { id: "pre-1" } });

    await handleMercadoPagoBillingWebhook(req, res);

    // Falha real: 500 pro Mercado Pago REENVIAR a notificação (auditoria 2026-10-10;
    // antes era 200 e o pagamento/ativação ficava perdido) + alerta pro dono.
    expect(getResult().statusCode).toBe(500);
    expect(mocks.alertSystemError).toHaveBeenCalledWith(
      "Falha no webhook de cobrança (Mercado Pago)",
      expect.stringContaining("timeout consultando Mercado Pago"),
      "mercadoPagoBillingWebhook",
      "Cobrança de assinatura (webhook Mercado Pago)",
    );
  });

  it("caminho feliz (evento já processado) não dispara alerta nenhum", async () => {
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized", payerId: 1 });
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: true });
    const { req, res } = fakeReqRes({ type: "subscription_preapproval", data: { id: "pre-1" } });

    await handleMercadoPagoBillingWebhook(req, res);

    expect(mocks.alertSystemError).not.toHaveBeenCalled();
  });
});

describe("handleMercadoPagoBillingWebhook — falha ao APLICAR não perde o pagamento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("desfaz o já-processado e responde 500 pra o reenvio do Mercado Pago ser aplicado", async () => {
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized", payerId: 1 });
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false });
    mocks.applyPreapprovalStatus.mockRejectedValue(new Error("deadlock no banco"));
    mocks.unmarkWebhookEvent.mockResolvedValue(undefined);
    const { req, res, getResult } = fakeReqRes({ type: "subscription_preapproval", data: { id: "pre-1" } });

    await handleMercadoPagoBillingWebhook(req, res);

    expect(getResult().statusCode).toBe(500);
    expect(mocks.unmarkWebhookEvent).toHaveBeenCalledWith({ gateway: "mercadopago", gatewayEventId: "subscription_preapproval:pre-1:authorized" });
  });

  it("aplicou com sucesso: mantém o já-processado e responde 200", async () => {
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized", payerId: 1 });
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false });
    mocks.applyPreapprovalStatus.mockResolvedValue(undefined);
    const { req, res, getResult } = fakeReqRes({ type: "subscription_preapproval", data: { id: "pre-1" } });

    await handleMercadoPagoBillingWebhook(req, res);

    expect(getResult().statusCode).toBe(200);
    expect(mocks.unmarkWebhookEvent).not.toHaveBeenCalled();
  });
});

describe("handleMercadoPagoSignupWebhook — alerta em falha real", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falha ao consultar o pagamento dispara alerta com área do site comercial", async () => {
    mocks.getPayment.mockRejectedValue(new Error("conexão recusada"));
    const { req, res, getResult } = fakeReqRes({ type: "payment", data: { id: "pay-1" } });

    await handleMercadoPagoSignupWebhook(req, res);

    expect(getResult().statusCode).toBe(500);
    expect(mocks.alertSystemError).toHaveBeenCalledWith(
      "Falha no webhook de taxa de implementação (Mercado Pago)",
      expect.stringContaining("conexão recusada"),
      "mercadoPagoSignupWebhook",
      "Site comercial — pagamento de cadastro (webhook Mercado Pago)",
    );
  });

  it("caminho feliz (evento já processado) não dispara alerta nenhum", async () => {
    mocks.getPayment.mockResolvedValue({ id: "pay-1", status: "pending", externalReference: "10" });
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: true });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "pay-1" } });

    await handleMercadoPagoSignupWebhook(req, res);

    expect(mocks.alertSystemError).not.toHaveBeenCalled();
  });
});
