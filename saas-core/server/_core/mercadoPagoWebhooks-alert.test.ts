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
}));

vi.mock("./telegramService", () => ({ alertSystemError: mocks.alertSystemError }));
vi.mock("./env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", mercadoPagoWebhookSecret: "" } }));
vi.mock("./mercadoPagoBilling", () => ({
  getSubscriptionPreapproval: mocks.getSubscriptionPreapproval,
  getAuthorizedPayment: mocks.getAuthorizedPayment,
  verifyMercadoPagoWebhookSignature: vi.fn(() => true),
}));
vi.mock("./mercadoPagoCheckout", () => ({ getPayment: mocks.getPayment }));
vi.mock("../db/webhookEvents", () => ({ markWebhookEventOnce: mocks.markWebhookEventOnce }));

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

    // Contrato documentado do MP: sempre 200 aqui, mesmo em falha (notificação
    // de assinatura não tem reenvio automático) — o alerta é o que garante
    // que a falha não fica invisível.
    expect(getResult().statusCode).toBe(200);
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

describe("handleMercadoPagoSignupWebhook — alerta em falha real", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falha ao consultar o pagamento dispara alerta com área do site comercial", async () => {
    mocks.getPayment.mockRejectedValue(new Error("conexão recusada"));
    const { req, res, getResult } = fakeReqRes({ type: "payment", data: { id: "pay-1" } });

    await handleMercadoPagoSignupWebhook(req, res);

    expect(getResult().statusCode).toBe(200);
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
