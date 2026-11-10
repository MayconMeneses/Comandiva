import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Painel Master: gerar link de autorização do Mercado Pago. O backUrl é
 * montado no servidor (nunca vem do cliente) e uma assinatura ativa já ligada
 * ao Mercado Pago não ganha segunda autorização. Mercado Pago mockado.
 */
const mocks = vi.hoisted(() => ({
  getRestaurantById: vi.fn(),
  getSubscriptionForRestaurant: vi.fn(),
  attachMercadoPagoPreapproval: vi.fn(),
  createSubscriptionPreapproval: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/env", () => ({ ENV: { platformJwtSecret: "x".repeat(40), operatorToken: "", isProduction: false, mercadoPagoAccessToken: "TEST-token" } }));
vi.mock("./db/restaurants", () => ({ getRestaurantById: mocks.getRestaurantById }));
vi.mock("./db/subscriptions", () => ({ getSubscriptionForRestaurant: mocks.getSubscriptionForRestaurant, attachMercadoPagoPreapproval: mocks.attachMercadoPagoPreapproval }));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("./_core/mercadoPagoBilling", () => ({ createSubscriptionPreapproval: mocks.createSubscriptionPreapproval }));

import { buildAuthorizationBackUrl, masterPanelBillingRouter } from "./routers/masterPanel/billing";

const ctx = { platformAdmin: { id: 1, email: "dono@x.com", role: "owner", permissions: ["billing"], active: true }, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
const caller = () => masterPanelBillingRouter.createCaller(ctx);
const subscription = (over: Record<string, unknown> = {}) => ({ subscription: { id: 3, status: "trial", gatewaySubscriptionId: null, ...over }, plan: { name: "Essencial", priceCents: 14990 } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRestaurantById.mockResolvedValue({ id: 7, contactEmail: "dono@teste.com", deploymentUrl: "https://pizzaria.exemplo.com/" });
  mocks.getSubscriptionForRestaurant.mockResolvedValue(subscription());
  mocks.createSubscriptionPreapproval.mockResolvedValue({ id: "pre-9", initPoint: "https://mp.exemplo/auth" });
});

describe("startMercadoPagoSubscription", () => {
  it("usa como retorno a página Meu plano pública do restaurante, montada no servidor", async () => {
    const result = await caller().startMercadoPagoSubscription({ restaurantId: 7 });
    expect(result.authorizationUrl).toBe("https://mp.exemplo/auth");
    expect(mocks.createSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ backUrl: "https://pizzaria.exemplo.com/admin/plano" }));
  });

  it("ignora um backUrl enviado pelo cliente (ex.: a URL do próprio Painel Master)", async () => {
    await caller().startMercadoPagoSubscription({ restaurantId: 7, backUrl: "https://master.exemplo/login" } as never);
    expect(mocks.createSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ backUrl: "https://pizzaria.exemplo.com/admin/plano" }));
  });

  it("sem endereço público do restaurante: erro claro e nada é criado no Mercado Pago", async () => {
    mocks.getRestaurantById.mockResolvedValue({ id: 7, contactEmail: "dono@teste.com", deploymentUrl: null });
    await expect(caller().startMercadoPagoSubscription({ restaurantId: 7 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createSubscriptionPreapproval).not.toHaveBeenCalled();
  });

  it("assinatura ativa já ligada ao Mercado Pago: recusa nova autorização", async () => {
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subscription({ status: "active", gatewaySubscriptionId: "pre-1" }));
    await expect(caller().startMercadoPagoSubscription({ restaurantId: 7 })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.createSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(mocks.attachMercadoPagoPreapproval).not.toHaveBeenCalled();
  });

  it("assinatura com preapproval antiga mas não ativa (ex.: payment_pending) ainda pode gerar novo link", async () => {
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subscription({ status: "payment_pending", gatewaySubscriptionId: "pre-old" }));
    await caller().startMercadoPagoSubscription({ restaurantId: 7 });
    expect(mocks.createSubscriptionPreapproval).toHaveBeenCalledTimes(1);
  });
});

describe("buildAuthorizationBackUrl", () => {
  it("rejeita vazio, http e hosts privados", () => {
    expect(buildAuthorizationBackUrl(null)).toBeNull();
    expect(buildAuthorizationBackUrl("http://x.com")).toBeNull();
    expect(buildAuthorizationBackUrl("https://192.168.0.2")).toBeNull();
  });
});

