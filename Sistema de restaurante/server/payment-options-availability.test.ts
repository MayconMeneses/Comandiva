import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Pix vale com cobrança automática do gateway OU com a chave Pix cadastrada pelo
 * restaurante; cartão online só com gateway conectado. A chave nunca vai a visitante
 * sem pedido: só aparece em `order.track` para pedido em Pix ainda não pago.
 */
const mocks = vi.hoisted(() => ({
  getActiveGatewayAndProvider: vi.fn(),
  getStoreSettings: vi.fn(),
  getActiveOrdersByPhone: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getStoreSettings: mocks.getStoreSettings,
  getActiveOrdersByPhone: mocks.getActiveOrdersByPhone,
}));
vi.mock("./payments/paymentService", async importOriginal => ({
  ...(await importOriginal<typeof import("./payments/paymentService")>()),
  getActiveGatewayAndProvider: mocks.getActiveGatewayAndProvider,
}));

import { appRouter } from "./routers";

let ipCounter = 0;
const caller = () => appRouter.createCaller({ user: null, req: { ip: `203.0.113.${100 + ipCounter++}`, protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext);
const GATEWAY_COM_PIX_E_CARTAO = { gateway: { apiKey: "x", label: "Mercado Pago" }, provider: { getCapabilities: () => ({ pix: true, card: true, installments: false }) } };
const checkout = (paymentMethod: "PIX" | "CARD_ONLINE") => ({
  items: [{ productId: 1, quantity: 1, addonOptionIds: [] }],
  fulfillmentType: "PICKUP" as const,
  paymentMethod,
  customer: { name: "Maria Teste", phone: "85999991234" },
  operationId: "op-teste-0001",
});

function pixOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, status: "PENDING", fulfillmentType: "DELIVERY", paymentMethod: "PIX", totalCents: 3200, createdAt: 1, items: [], history: [],
    payment: { status: "PENDING", metadata: null }, ...overrides,
  };
}

describe("order.paymentCapabilities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem gateway e com chave Pix cadastrada: Pix manual disponível, sem expor a chave", async () => {
    mocks.getActiveGatewayAndProvider.mockRejectedValue(new Error("sem gateway"));
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "dono@exemplo.com", pixQrCodeUrl: null });
    const result = await caller().order.paymentCapabilities();
    expect(result).toEqual({ pix: false, card: false, installments: false, pixKey: true });
    expect(JSON.stringify(result)).not.toContain("dono@exemplo.com");
  });

  it("sem gateway e sem chave: nada disponível", async () => {
    mocks.getActiveGatewayAndProvider.mockRejectedValue(new Error("sem gateway"));
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "  ", pixQrCodeUrl: null });
    expect(await caller().order.paymentCapabilities()).toEqual({ pix: false, card: false, installments: false, pixKey: false });
  });

  it("com gateway: repassa as capacidades dele", async () => {
    mocks.getActiveGatewayAndProvider.mockResolvedValue(GATEWAY_COM_PIX_E_CARTAO);
    mocks.getStoreSettings.mockResolvedValue({ pixKey: null });
    expect(await caller().order.paymentCapabilities()).toEqual({ pix: true, card: true, installments: false, pixKey: false });
  });
});

describe("order.create recusa forma de pagamento indisponível", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Pix sem gateway e sem chave cadastrada", async () => {
    mocks.getActiveGatewayAndProvider.mockRejectedValue(new Error("sem gateway"));
    mocks.getStoreSettings.mockResolvedValue({ pixKey: null });
    await expect(caller().order.create(checkout("PIX"))).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Pix") });
  });

  it("cartão online sem gateway conectado", async () => {
    mocks.getActiveGatewayAndProvider.mockRejectedValue(new Error("sem gateway"));
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "chave" });
    await expect(caller().order.create(checkout("CARD_ONLINE"))).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("cartão") });
  });

  it("Pix com chave cadastrada passa pela checagem de disponibilidade (falha adiante só por falta de banco, não por Pix)", async () => {
    mocks.getActiveGatewayAndProvider.mockRejectedValue(new Error("sem gateway"));
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "chave" });
    const error = await caller().order.create(checkout("PIX")).catch(caught => caught);
    expect(String(error?.message ?? "")).not.toContain("O Pix ainda não está disponível");
  });
});

describe("order.track mostra a chave Pix só para pedido em Pix ainda pendente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pedido em Pix pendente sem cobrança automática: devolve a chave e o QR cadastrados", async () => {
    mocks.getActiveOrdersByPhone.mockResolvedValue([pixOrder()]);
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "dono@exemplo.com", pixQrCodeUrl: "https://cdn/qr.png" });
    const [order] = await caller().order.track({ phone: "85999991234" });
    expect(order?.pixManual).toEqual({ key: "dono@exemplo.com", qrCodeUrl: "https://cdn/qr.png" });
  });

  it("pagamento já resolvido: não mostra mais a chave", async () => {
    mocks.getActiveOrdersByPhone.mockResolvedValue([pixOrder({ payment: { status: "PAID", metadata: null } })]);
    mocks.getStoreSettings.mockResolvedValue({ pixKey: "dono@exemplo.com", pixQrCodeUrl: null });
    const [order] = await caller().order.track({ phone: "85999991234" });
    expect(order?.pixManual).toBeNull();
  });

  it("pedido em dinheiro não recebe a chave (e nem consulta as configurações)", async () => {
    mocks.getActiveOrdersByPhone.mockResolvedValue([pixOrder({ paymentMethod: "CASH" })]);
    const [order] = await caller().order.track({ phone: "85999991234" });
    expect(order?.pixManual).toBeNull();
    expect(mocks.getStoreSettings).not.toHaveBeenCalled();
  });

  it("sem chave cadastrada: nada a mostrar", async () => {
    mocks.getActiveOrdersByPhone.mockResolvedValue([pixOrder()]);
    mocks.getStoreSettings.mockResolvedValue({ pixKey: null, pixQrCodeUrl: null });
    const [order] = await caller().order.track({ phone: "85999991234" });
    expect(order?.pixManual).toBeNull();
  });
});
