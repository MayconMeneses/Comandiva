import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// Cobre os dois achados de auditoria em server/routers/order.ts
// (createCardPayment/createPixPayment): (1) nenhum dos dois verificava
// order.status, permitindo gerar e pagar uma cobrança pra um pedido já
// cancelado pela equipe; (2) a chave de idempotência do Pix era fixa por
// pedido, então regenerar um Pix depois que o anterior venceu devolvia a
// cobrança antiga (já vencida de verdade) em vez de criar uma nova.
const mocks = vi.hoisted(() => ({
  getOrderByTrackingCode: vi.fn(),
  savePixChargeForOrder: vi.fn(),
  getActiveGatewayAndProvider: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getOrderByTrackingCode: mocks.getOrderByTrackingCode,
  savePixChargeForOrder: mocks.savePixChargeForOrder,
}));

vi.mock("./payments/paymentService", async importOriginal => ({
  ...(await importOriginal<typeof import("./payments/paymentService")>()),
  getActiveGatewayAndProvider: mocks.getActiveGatewayAndProvider,
}));

import { appRouter } from "./routers";

function contextWithIp(ip: string): TrpcContext {
  return { user: null, req: { ip, protocol: "https", headers: {} }, res: {} } as TrpcContext;
}

function fakeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    publicCode: "PX-TEST001",
    customerPhone: "85999991234",
    status: "PENDING",
    totalCents: 5000,
    payment: null,
    ...overrides,
  };
}

const GATEWAY = { apiKey: "token", label: "Mercado Pago" };
const CPF = "12345678909";

describe("order.createPixPayment — pedido cancelado e idempotência por tentativa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa gerar Pix para um pedido já cancelado, sem sequer chamar o gateway", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(fakeOrder({ status: "CANCELLED" }));
    const createPixPayment = vi.fn();
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createPixPayment } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.90"));
    await expect(
      caller.order.createPixPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234", payerCpf: CPF }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createPixPayment).not.toHaveBeenCalled();
  });

  it("primeira cobrança do pedido (sem cobrança anterior) usa chave de idempotência baseada em 'initial'", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(fakeOrder());
    const createPixPayment = vi.fn().mockResolvedValue({ providerPaymentId: "PAY-1", status: "PENDING", pixCopyPaste: "codigo-1", expiresAt: Date.now() + 30 * 60_000 });
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createPixPayment } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.91"));
    await caller.order.createPixPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234", payerCpf: CPF });
    expect(createPixPayment).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "pix:PX-TEST001:initial" }));
  });

  it("regenerar o Pix depois que o anterior venceu usa uma chave de idempotência DIFERENTE (não devolve a cobrança antiga)", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(
      fakeOrder({
        payment: {
          status: "PENDING",
          method: "PIX",
          providerReference: "PAY-OLD-EXPIRED",
          metadata: JSON.stringify({ pixCopyPaste: "codigo-velho", pixExpiresAt: Date.now() - 1_000 }),
        },
      }),
    );
    const createPixPayment = vi.fn().mockResolvedValue({ providerPaymentId: "PAY-2", status: "PENDING", pixCopyPaste: "codigo-novo", expiresAt: Date.now() + 30 * 60_000 });
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createPixPayment } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.92"));
    const result = await caller.order.createPixPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234", payerCpf: CPF });
    expect(createPixPayment).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "pix:PX-TEST001:PAY-OLD-EXPIRED" }));
    expect(result.pixCopyPaste).toBe("codigo-novo");
  });

  it("reaproveita a cobrança Pix ainda válida sem chamar o gateway de novo", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(
      fakeOrder({
        payment: {
          status: "PENDING",
          method: "PIX",
          providerReference: "PAY-VALID",
          metadata: JSON.stringify({ pixCopyPaste: "codigo-valido", pixExpiresAt: Date.now() + 10 * 60_000 }),
        },
      }),
    );
    const createPixPayment = vi.fn();
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createPixPayment } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.93"));
    const result = await caller.order.createPixPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234", payerCpf: CPF });
    expect(createPixPayment).not.toHaveBeenCalled();
    expect(result.pixCopyPaste).toBe("codigo-valido");
  });
});

describe("order.createCardPayment — pedido cancelado e idempotência por tentativa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recusa gerar cobrança de cartão para um pedido já cancelado, sem sequer chamar o gateway", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(fakeOrder({ status: "CANCELLED" }));
    const createCardCheckout = vi.fn();
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createCardCheckout } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.94"));
    await expect(
      caller.order.createCardPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createCardCheckout).not.toHaveBeenCalled();
  });

  it("usa chave de idempotência baseada na cobrança anterior, quando existe", async () => {
    mocks.getOrderByTrackingCode.mockResolvedValue(fakeOrder({ payment: { status: "PENDING", method: "CARD_ONLINE", providerReference: "PREF-OLD" } }));
    const createCardCheckout = vi.fn().mockResolvedValue({ redirectUrl: "https://mercadopago.com/checkout/xyz" });
    mocks.getActiveGatewayAndProvider.mockResolvedValue({ gateway: GATEWAY, provider: { createCardCheckout } });
    const caller = appRouter.createCaller(contextWithIp("203.0.113.95"));
    await caller.order.createCardPayment({ publicCode: "PX-TEST001", customerPhone: "85999991234" });
    expect(createCardCheckout).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "card:PX-TEST001:PREF-OLD" }));
  });
});
