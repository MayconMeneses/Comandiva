import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { verifyMercadoPagoWebhookSignature } from "./_core/mercadoPago";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getMercadoPagoPayment: vi.fn(),
  markOrderPaymentPaidByPublicCode: vi.fn(),
  markOrderPaymentFailedByPublicCode: vi.fn(),
  markWebhookEventOnce: vi.fn(),
  sendOwnerAlert: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb, markOrderPaymentPaidByPublicCode: mocks.markOrderPaymentPaidByPublicCode, markOrderPaymentFailedByPublicCode: mocks.markOrderPaymentFailedByPublicCode }));
// Alerta do dono (Telegram/e-mail) — mockado pra provar que uma falha real
// no processamento do webhook (não os retornos 200 esperados) dispara o
// aviso, em vez de só sumir no console (ver server/_core/trpc.ts:5 pro
// mesmo raciocínio aplicado a erro interno de requisição tRPC).
vi.mock("./_core/alerts", () => ({ sendOwnerAlert: mocks.sendOwnerAlert }));
vi.mock("./_core/mercadoPago", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/mercadoPago")>()),
  getMercadoPagoPayment: mocks.getMercadoPagoPayment,
}));
// Idempotência real bate no banco (INSERT) — mockada aqui pra não precisar de
// um banco de verdade só pra testar o roteamento de status; o comportamento
// dela em si (unique constraint) é coberto separadamente.
vi.mock("./payments/repositories/webhookEvents", () => ({ markWebhookEventOnce: mocks.markWebhookEventOnce }));

import { handleMercadoPagoWebhook } from "./payments/webhooks/mercadopago";

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
const ACTIVE_MP_GATEWAY = { active: true, provider: "MERCADO_PAGO", label: "Mercado Pago", apiKey: "token", secretKey: null as string | null };

function sign(manifest: string, secret = SECRET) {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

// applyPaymentStatusNotification agora roda dentro de db.transaction(...) —
// como markWebhookEventOnce/markOrderPaymentPaidByPublicCode/
// markOrderPaymentFailedByPublicCode já são mockados individualmente (não
// leem o `tx` de verdade), o fake `transaction` só precisa invocar o
// callback com qualquer objeto.
function gatewayDb(gateway: typeof ACTIVE_MP_GATEWAY | null) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (gateway ? [gateway] : []) }) }) }),
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn({}),
  };
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
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false });
    mocks.markOrderPaymentPaidByPublicCode.mockResolvedValue({ found: true, orderId: 1 });
    mocks.markOrderPaymentFailedByPublicCode.mockResolvedValue({ found: true, orderId: 1 });
  });

  it("com chave secreta configurada: assinatura válida processa o pagamento normalmente", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb({ ...ACTIVE_MP_GATEWAY, secretKey: SECRET }));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234" });
    const ts = "1700000000000";
    const v1 = sign(`id:123;request-id:req-1;ts:${ts};`);
    const { req, res, getResult } = fakeReqRes(
      { type: "payment", data: { id: "123" } },
      { query: { "data.id": "123" }, headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" } },
    );
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(mocks.getMercadoPagoPayment).toHaveBeenCalledWith("token", "123");
    expect(mocks.markOrderPaymentPaidByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", expect.anything());
  });

  it("com chave secreta configurada: assinatura inválida ignora sem consultar a API", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb({ ...ACTIVE_MP_GATEWAY, secretKey: SECRET }));
    const { req, res, getResult } = fakeReqRes(
      { type: "payment", data: { id: "123" } },
      { query: { "data.id": "123" }, headers: { "x-signature": "ts=1700000000000,v1=deadbeef", "x-request-id": "req-1" } },
    );
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).toBe(200);
    expect(mocks.getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("sem chave secreta configurada: continua processando como antes (comportamento existente preservado)", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234" });
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
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "rejected", statusDetail: null, externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", "CANCELLED", expect.anything());
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });

  it("pagamento estornado (refunded) marca o pagamento do pedido como REFUNDED", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "refunded", statusDetail: null, externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", "REFUNDED", expect.anything());
  });

  it("Pix vencido sem pagamento (cancelled + status_detail=expired) marca o pagamento como EXPIRED, não CANCELLED", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "cancelled", statusDetail: "expired", externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).toHaveBeenCalledWith("PX-ABC1234", "123", "EXPIRED", expect.anything());
  });

  it("pagamento pendente/em processo não muda nada (nem paga, nem falha)", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "in_process", statusDetail: null, externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentFailedByPublicCode).not.toHaveBeenCalled();
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });

  it("idempotência: a mesma notificação (mesmo id + mesmo status) processada de novo não aplica o efeito uma segunda vez", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234" });
    mocks.markWebhookEventOnce.mockResolvedValue({ alreadyProcessed: true });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.markOrderPaymentPaidByPublicCode).not.toHaveBeenCalled();
  });

  it("falha real ao aplicar o efeito (ex.: erro transitório de banco) responde erro, não 200 — pro Mercado Pago reenviar depois", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234" });
    mocks.markOrderPaymentPaidByPublicCode.mockRejectedValue(new Error("conexão com o banco perdida"));
    const { req, res, getResult } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(getResult().statusCode).not.toBe(200);
    // Falha real (não os retornos 200 esperados) precisa avisar o dono — sem
    // isso, um pagamento aprovado que falha ao ser gravado fica invisível até
    // alguém notar o pedido "sumido" no operacional.
    expect(mocks.sendOwnerAlert).toHaveBeenCalledWith(
      "Falha no webhook de pagamento (Mercado Pago)",
      expect.stringContaining("conexão com o banco perdida"),
      "mercadoPagoWebhook",
      undefined,
      "Pagamento de pedido (webhook Mercado Pago)",
    );
  });

  it("caminho feliz não dispara alerta nenhum (sem ruído pra falha que não aconteceu)", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-ABC1234" });
    const { req, res } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await handleMercadoPagoWebhook(req, res);
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
  });

  it("notificação referenciando um pedido inexistente não trava nem finge sucesso", async () => {
    mocks.getDb.mockResolvedValue(gatewayDb(ACTIVE_MP_GATEWAY));
    mocks.getMercadoPagoPayment.mockResolvedValue({ id: 123, status: "approved", statusDetail: null, externalReference: "PX-NAO-EXISTE" });
    mocks.markOrderPaymentPaidByPublicCode.mockResolvedValue({ found: false });
    const { req, res, getResult } = fakeReqRes({ type: "payment", data: { id: "123" } });
    await expect(handleMercadoPagoWebhook(req, res)).resolves.not.toThrow();
    expect(getResult().statusCode).toBe(200);
  });
});
