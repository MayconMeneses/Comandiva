import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

/**
 * Auditoria de segurança 2026-10-10 — webhook do Mercado Pago (pedidos):
 * valor/moeda conferidos antes de marcar como pago, um id só (query) para
 * assinatura e consulta, e excesso de requisições responde 429 (o MP reenvia)
 * em vez de 200 (que fazia o aviso se perder).
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
  markOrderPaymentPaidByPublicCode: vi.fn(),
  markOrderPaymentFailedByPublicCode: vi.fn(),
  markWebhookEventOnce: vi.fn(),
  sendOwnerAlert: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb, markOrderPaymentPaidByPublicCode: mocks.markOrderPaymentPaidByPublicCode, markOrderPaymentFailedByPublicCode: mocks.markOrderPaymentFailedByPublicCode }));
vi.mock("./_core/alerts", () => ({ sendOwnerAlert: mocks.sendOwnerAlert }));
vi.mock("./_core/mercadoPago", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/mercadoPago")>()),
  getMercadoPagoPayment: mocks.getMercadoPagoPayment,
}));
vi.mock("./payments/repositories/webhookEvents", () => ({ markWebhookEventOnce: mocks.markWebhookEventOnce }));

import { handleMercadoPagoWebhook } from "./payments/webhooks/mercadopago";

const SECRET = "test-webhook-secret";

function fakeReqRes(body: unknown, options: { ip?: string; query?: Record<string, string> } = {}) {
  let statusCode: number | undefined;
  // Assinatura é obrigatória: a requisição de teste já vai assinada com o segredo do gateway.
  const bodyId = (body as { data?: { id?: string | number } } | undefined)?.data?.id;
  const signedId = options.query?.["data.id"] ?? (bodyId !== undefined ? String(bodyId) : undefined);
  const headers: Record<string, string> = signedId ? { "x-signature": `ts=1700000000000,v1=${createHmac("sha256", SECRET).update(`id:${signedId};request-id:req-auto;ts:1700000000000;`).digest("hex")}`, "x-request-id": "req-auto" } : {};
  const req = { body, query: options.query ?? {}, ip: options.ip ?? "203.0.113.60", header: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json() { return this; },
  } as unknown as Response;
  return { req, res, status: () => statusCode };
}

const GATEWAY = { active: true, provider: "MERCADO_PAGO", label: "Mercado Pago", apiKey: "token", secretKey: SECRET };
const db = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [GATEWAY] }) }) }),
  transaction: async (fn: (tx: unknown) => Promise<void>) => fn({}),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDb.mockResolvedValue(db);
  mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false });
  mocks.markOrderPaymentPaidByPublicCode.mockResolvedValue({ found: true, orderId: 1 });
  mocks.markOrderPaymentFailedByPublicCode.mockResolvedValue({ found: true, orderId: 1 });
});

describe("webhook MP — valor e moeda do pagamento", () => {
  it("passa valor e moeda do gateway pra conferência antes de marcar como pago", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234", amountCents: 4590, currency: "BRL" });
    const { req, res, status } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(status()).toBe(200);
    expect(mocks.markOrderPaymentPaidByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", expect.anything(), { amountCents: 4590, currency: "BRL" });
  });

  it("valor que não bate com o pedido: não baixa, avisa o dono e responde 200 (não é erro de banco)", async () => {
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234", amountCents: 100, currency: "BRL" });
    mocks.markOrderPaymentPaidByPublicCode.mockResolvedValue({ found: true, orderId: 1, mismatch: true });
    const { req, res, status } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(status()).toBe(200);
    expect(mocks.sendOwnerAlert).toHaveBeenCalledOnce();
    expect(mocks.sendOwnerAlert.mock.calls[0][0]).toContain("valor diferente");
  });
});

describe("webhook MP — id único e limite de requisições", () => {
  it("id do corpo diferente do id da query: ignora, sem consultar a API do Mercado Pago", async () => {
    const { req, res, status } = fakeReqRes({ type: "payment", data: { id: "999" } }, { query: { "data.id": "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(status()).toBe(200);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });

  it("passou do limite: 429 (o Mercado Pago reenvia), não 200", async () => {
    const ip = "203.0.113.61";
    for (let i = 0; i < 60; i += 1) {
      await handleMercadoPagoWebhook(...(Object.values(fakeReqRes({ type: "outro" }, { ip })).slice(0, 2) as [Request, Response]));
    }
    const { req, res, status } = fakeReqRes({ type: "outro" }, { ip });
    await handleMercadoPagoWebhook(req, res);
    expect(status()).toBe(429);
  });
});
