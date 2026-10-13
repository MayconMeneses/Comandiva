import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Assinatura do webhook OBRIGATÓRIA (auditoria 2026-10-10): sem
 * MERCADO_PAGO_WEBHOOK_SECRET os dois webhooks recusam (503) em vez de aceitar
 * qualquer POST — o Mercado Pago reenvia depois que o segredo for configurado.
 */
const mocks = vi.hoisted(() => ({
  getSubscriptionPreapproval: vi.fn(),
  getPayment: vi.fn(),
  markWebhookEventOnce: vi.fn(),
  verify: vi.fn(() => true),
}));

vi.mock("./telegramService", () => ({ alertSystemError: vi.fn() }));
vi.mock("./env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", mercadoPagoWebhookSecret: "" } }));
vi.mock("./mercadoPagoBilling", () => ({
  getSubscriptionPreapproval: mocks.getSubscriptionPreapproval,
  getAuthorizedPayment: vi.fn(),
  verifyMercadoPagoWebhookSignature: mocks.verify,
}));
vi.mock("./mercadoPagoCheckout", () => ({ getPayment: mocks.getPayment }));
vi.mock("../db/webhookEvents", () => ({ markWebhookEventOnce: mocks.markWebhookEventOnce, unmarkWebhookEvent: vi.fn() }));
vi.mock("../db/subscriptions", () => ({
  applyDueScheduledChanges: vi.fn(),
  applyPreapprovalStatus: vi.fn(),
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
  const req = { body, query: {}, header: () => undefined } as unknown as Request;
  const res = { status(code: number) { statusCode = code; return this; }, json() { return this; } } as unknown as Response;
  return { req, res, status: () => statusCode };
}

beforeEach(() => vi.clearAllMocks());

describe("webhooks do Mercado Pago sem MERCADO_PAGO_WEBHOOK_SECRET", () => {
  it("cobrança de assinatura: 503, sem consultar a API nem gravar nada", async () => {
    const { req, res, status } = fakeReqRes({ type: "subscription_preapproval", data: { id: "pre-1" } });
    await handleMercadoPagoBillingWebhook(req, res);
    expect(status()).toBe(503);
    expect(mocks.getSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(mocks.markWebhookEventOnce).not.toHaveBeenCalled();
  });

  it("taxa de implementação (legado): 503, sem consultar a API nem gravar nada", async () => {
    const { req, res, status } = fakeReqRes({ type: "payment", data: { id: "pay-1" } });
    await handleMercadoPagoSignupWebhook(req, res);
    expect(status()).toBe(503);
    expect(mocks.getPayment).not.toHaveBeenCalled();
    expect(mocks.markWebhookEventOnce).not.toHaveBeenCalled();
  });
});
