import { describe, expect, it, vi } from "vitest";

/**
 * O painel do Mercado Pago só aceita UMA URL de webhook por aplicação —
 * esta rota combinada existe só pra despachar pro handler certo (assinatura
 * recorrente vs. pagamento avulso da taxa de implementação) por `type`.
 * Cobre só o roteamento — a lógica de cada handler já tem seus próprios
 * testes (billing.test.ts, verificação de assinatura em urlSafety.test.ts
 * etc.), aqui não duplicamos isso.
 */
const mocks = vi.hoisted(() => ({
  handleMercadoPagoBillingWebhook: vi.fn(async (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ received: true, handler: "billing" });
  }),
  handleMercadoPagoSignupWebhook: vi.fn(async (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ received: true, handler: "signup" });
  }),
}));

vi.mock("./mercadoPagoWebhook", () => ({ handleMercadoPagoBillingWebhook: mocks.handleMercadoPagoBillingWebhook }));
vi.mock("./mercadoPagoSignupWebhook", () => ({ handleMercadoPagoSignupWebhook: mocks.handleMercadoPagoSignupWebhook }));

import { handleMercadoPagoWebhook } from "./mercadoPagoWebhookRoute";

function fakeRes() {
  const res = { statusCode: 0, body: undefined as unknown, status(code: number) { res.statusCode = code; return res; }, json(body: unknown) { res.body = body; } };
  return res;
}

describe("handleMercadoPagoWebhook — despacho por type", () => {
  it("type=payment vai pro handler de signup (taxa de implementação)", async () => {
    mocks.handleMercadoPagoBillingWebhook.mockClear();
    mocks.handleMercadoPagoSignupWebhook.mockClear();
    const req = { body: { type: "payment", data: { id: "123" } }, query: {} };
    await handleMercadoPagoWebhook(req as never, fakeRes() as never);
    expect(mocks.handleMercadoPagoSignupWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.handleMercadoPagoBillingWebhook).not.toHaveBeenCalled();
  });

  it("type=subscription_preapproval vai pro handler de billing (assinatura)", async () => {
    mocks.handleMercadoPagoBillingWebhook.mockClear();
    mocks.handleMercadoPagoSignupWebhook.mockClear();
    const req = { body: { type: "subscription_preapproval", data: { id: "456" } }, query: {} };
    await handleMercadoPagoWebhook(req as never, fakeRes() as never);
    expect(mocks.handleMercadoPagoBillingWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.handleMercadoPagoSignupWebhook).not.toHaveBeenCalled();
  });

  it("type=subscription_authorized_payment vai pro handler de billing", async () => {
    mocks.handleMercadoPagoBillingWebhook.mockClear();
    mocks.handleMercadoPagoSignupWebhook.mockClear();
    const req = { body: { type: "subscription_authorized_payment", data: { id: "789" } }, query: {} };
    await handleMercadoPagoWebhook(req as never, fakeRes() as never);
    expect(mocks.handleMercadoPagoBillingWebhook).toHaveBeenCalledTimes(1);
  });

  it("tipo desconhecido/ausente cai no handler de billing (que já ignora e responde 200 sozinho)", async () => {
    mocks.handleMercadoPagoBillingWebhook.mockClear();
    mocks.handleMercadoPagoSignupWebhook.mockClear();
    const req = { body: {}, query: {} };
    await handleMercadoPagoWebhook(req as never, fakeRes() as never);
    expect(mocks.handleMercadoPagoBillingWebhook).toHaveBeenCalledTimes(1);
    expect(mocks.handleMercadoPagoSignupWebhook).not.toHaveBeenCalled();
  });

  it("lê o type da query string quando não vem no body (formato antigo do MP)", async () => {
    mocks.handleMercadoPagoBillingWebhook.mockClear();
    mocks.handleMercadoPagoSignupWebhook.mockClear();
    const req = { body: undefined, query: { type: "payment" } };
    await handleMercadoPagoWebhook(req as never, fakeRes() as never);
    expect(mocks.handleMercadoPagoSignupWebhook).toHaveBeenCalledTimes(1);
  });
});
