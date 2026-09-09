import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { verifyMercadoPagoWebhookSignature } from "./_core/mercadoPago";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
  markOrderPaymentPaidByPublicCode: vi.fn(),
  markOrderPaymentFailedByPublicCode: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb, markOrderPaymentPaidByPublicCode: mocks.markOrderPaymentPaidByPublicCode, markOrderPaymentFailedByPublicCode: mocks.markOrderPaymentFailedByPublicCode }));
vi.mock("./_core/mercadoPago", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/mercadoPago")>()),
  getMercadoPagoPayment: mocks.getMercadoPagoPayment,
}));

import { handleMercadoPagoWebhook } from "./_core/mercadoPagoWebhook";

function fakeReqRes(body: unknown, options: { ip?: string; query?: Record<string, string>; headers?: Record<string, string> } = {}) {
  let statusCode: number | undefined;
  let jsonBody: unknown;
  const headers = options.headers ?? {};
  const req = {
    body,
    query: options.query ?? {},
    ip: options.ip ?? "203.0.113.50",
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { jsonBody = payload; return this; },
  } as unknown as Response;
  return { req, res, getResult: () => ({ statusCode, jsonBody }) };
}

const SECRET = "test-webhook-secret";

function sign(manifest: string, secret = SECRET) {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("verifyMercadoPagoWebhookSignature", () => {
  it("aceita uma assinatura calculada corretamente (id + request-id + ts)", () => {
    const v1 = sign("id:123;request-id:req-1;ts:1700000000000;");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "123", secret: SECRET })).toBe(true);
  });

  it("aceita quando request-id está ausente (campo omitido do template)", () => {
    const v1 = sign("id:123;ts:1700000000000;");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: undefined, dataId: "123", secret: SECRET })).toBe(true);
  });

  it("rejeita quando o hash não bate (secret errado ou corpo adulterado)", () => {
    const v1 = sign("id:123;request-id:req-1;ts:1700000000000;", "outro-secret");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "123", secret: SECRET })).toBe(false);
  });

  it("rejeita quando data.id foi trocado (mesma assinatura, id diferente)", () => {
    const v1 = sign("id:123;request-id:req-1;ts:1700000000000;");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "999", secret: SECRET })).toBe(false);
  });

  it("rejeita header x-signature ausente ou malformado", () => {
    expect(verifyMercadoPagoWebhookSignature({ xSignature: undefined, xRequestId: "req-1", dataId: "123", secret: SECRET })).toBe(false);
    expect(verifyMercadoPagoWebhookSignature({ xSignature: "ts=1700000000000", xRequestId: "req-1", dataId: "123", secret: SECRET })).toBe(false);
  });
});

describe("webhook do Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("com chave secreta configurada: assinatura válida processa o pagamento normalmente", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: SECRET }] }) }) }) });
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", externalReference: "PX-ABC1234" });
    const ts = "1700000000000";
    const v1 = sign(`id:123;request-id:req-1;ts:${ts};`);
    const { req, res, getResult } = fakeReqRes(
      { type: "payment", data: { id: "123" } },
      { query: { "data.id": "123" }, headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" } },
    );
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(mocks.getMercadoPagoPayment).toHaveBeenCalledWith("token", "123");
    expect(mocks.markOrderPaymentPaidByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123");
  });

  it("com chave secreta configurada: assinatura inválida ignora sem consultar a API", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: SECRET }] }) }) }) });
    const { req, res, getResult } = fakeReqRes(
      { type: "payment", data: { id: "123" } },
      { query: { "data.id": "123" }, headers: { "x-signature": "ts=1700000000000,v1=deadbeef", "x-request-id": "req-1" } },
    );
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("sem chave secreta configurada: continua processando como antes (comportamento existente preservado)", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: null }] }) }) }) });
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", externalReference: "PX-ABC1234" });
    const { req, res, getResult } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(mocks.getMercadoPagoPayment).toHaveBeenCalledWith("token", "123");
  });

  it("responde 200 rapidamente para notificações de tipo desconhecido, sem quebrar", async () => {
    const { req, res, getResult } = fakeReqRes({ type: "merchant_order", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(getResult().jsonBody).toEqual({ received: true });
  });

  it("responde 200 quando não há ID de pagamento no corpo", async () => {
    const { req, res, getResult } = fakeReqRes({ type: "payment" });
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
  });

  it("não lança exceção para corpo vazio/malformado", async () => {
    const { req, res, getResult } = fakeReqRes(undefined);
    await expect(handleMercadoPagoWebhook(req, res)).resolves.not.toThrow();
    expect(getResult().statusCode).toBe(200);
  });

  it("pagamento recusado (rejected) marca o pagamento do pedido como CANCELLED", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: null }] }) }) }) });
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "rejected", externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", "CANCELLED");
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });

  it("pagamento estornado (refunded) marca o pagamento do pedido como REFUNDED", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: null }] }) }) }) });
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "refunded", externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", "REFUNDED");
  });

  it("pagamento pendente/em processo não muda nada (nem paga, nem falha)", async () => {
    mocks.getDb.mockResolvedValue({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ active: true, apiKey: "token", secretKey: null }] }) }) }) });
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "in_process", externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).not.toHaveBeenCalled();
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });
});
