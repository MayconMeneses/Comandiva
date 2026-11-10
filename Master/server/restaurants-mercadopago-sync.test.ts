import { beforeEach, describe, expect, it, vi } from "vitest";
import { restaurants, subscriptions } from "../drizzle/schema";

/**
 * Painel Master: cancelar/suspender restaurante avisa o Mercado Pago antes de
 * gravar o status local, e "marcar como entregue" só fala em teste grátis
 * quando a assinatura realmente está em "trial". Tudo com mocks: nenhum
 * Mercado Pago, Telegram ou e-mail de verdade é chamado.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getSubscriptionForRestaurant: vi.fn(),
  updateSubscriptionPreapproval: vi.fn(),
  getSubscriptionPreapproval: vi.fn(),
  sendTelegramMessageAsync: vi.fn(),
  sendEmailAsync: vi.fn(),
  token: "TEST-token",
}));

vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttlMs: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./db/subscriptions", () => ({ getSubscriptionForRestaurant: mocks.getSubscriptionForRestaurant, listBillingPaymentsForSubscription: vi.fn() }));
vi.mock("./db/plans", () => ({ getPlanByKey: vi.fn() }));
vi.mock("./db/auditLog", () => ({ listPlatformAuditLog: vi.fn() }));
vi.mock("./_core/mercadoPagoBilling", () => ({ updateSubscriptionPreapproval: mocks.updateSubscriptionPreapproval, getSubscriptionPreapproval: mocks.getSubscriptionPreapproval }));
vi.mock("./_core/emailService", () => ({ sendEmailAsync: mocks.sendEmailAsync }));
vi.mock("./_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: mocks.sendTelegramMessageAsync };
});
vi.mock("./_core/env", () => ({ ENV: { get mercadoPagoAccessToken() { return mocks.token; } }, commercialHomeUrl: "https://site.exemplo" }));

import { markRestaurantDelivered, setRestaurantStatus } from "./db/restaurants";

/** Banco falso: select de restaurants devolve a linha dada; registra updates/inserts. */
function buildDb(restaurantRow: Record<string, unknown>) {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  const inserts: Array<Record<string, unknown>> = [];
  const db = {
    select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => (table === restaurants ? [restaurantRow] : []) }) }) }),
    update: (table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push({ table, values }); } }) }),
    insert: () => ({ values: async (values: Record<string, unknown>) => { inserts.push(values); } }),
  };
  return { db, updates, inserts };
}

const RESTAURANT = { id: 7, name: "Pizzaria", status: "active", deliveredAt: null, contactEmail: "dono@teste.com", contactName: "Dono", deploymentUrl: null };
const subRow = (over: Record<string, unknown>) => ({ subscription: { id: 3, restaurantId: 7, status: "active", gateway: "MERCADO_PAGO", gatewaySubscriptionId: "pre-1", ...over }, plan: { id: 1, name: "Essencial" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = "TEST-token";
  mocks.updateSubscriptionPreapproval.mockResolvedValue(undefined);
  mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized" });
});

describe("setRestaurantStatus + Mercado Pago", () => {
  it("cancelar: pede cancelled ao Mercado Pago ANTES de gravar o status local", async () => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { expect(stub.updates).toHaveLength(0); });
    await setRestaurantStatus(7, "cancelled");
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-1", status: "cancelled" });
    expect(stub.updates[0].values).toMatchObject({ status: "cancelled" });
  });

  it("suspender: pede paused ao Mercado Pago", async () => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    await setRestaurantStatus(7, "suspended");
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith(expect.objectContaining({ status: "paused" }));
    expect(stub.updates[0].values).toMatchObject({ status: "suspended" });
  });

  it("Mercado Pago recusa: status local NÃO muda e o erro é claro em pt-BR", async () => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("Mercado Pago recusou a atualização da assinatura."));
    await expect(setRestaurantStatus(7, "cancelled")).rejects.toMatchObject({ code: "BAD_GATEWAY", message: expect.stringContaining("Mercado Pago não aceitou o cancelamento") });
    expect(stub.updates).toHaveLength(0);
  });

  it("sem credencial do Mercado Pago mas com assinatura ligada: recusa sem alterar nada", async () => {
    mocks.token = "";
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    await expect(setRestaurantStatus(7, "cancelled")).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(stub.updates).toHaveLength(0);
  });

  it("sem gatewaySubscriptionId: muda só localmente, sem chamar o Mercado Pago", async () => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({ gateway: "MANUAL", gatewaySubscriptionId: null }));
    await setRestaurantStatus(7, "cancelled");
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(stub.updates[0].values).toMatchObject({ status: "cancelled" });
  });

  it("reativar a partir de suspenso: retoma a cobrança (authorized) no Mercado Pago antes de gravar", async () => {
    const stub = buildDb({ ...RESTAURANT, status: "suspended" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    mocks.updateSubscriptionPreapproval.mockImplementation(async () => { expect(stub.updates).toHaveLength(0); });
    await setRestaurantStatus(7, "active");
    expect(mocks.updateSubscriptionPreapproval).toHaveBeenCalledWith({ accessToken: "TEST-token", preapprovalId: "pre-1", status: "authorized" });
    expect(stub.updates[0].values).toMatchObject({ status: "active" });
  });

  it("reativar a partir de suspenso e o Mercado Pago recusa: continua suspenso, erro claro", async () => {
    const stub = buildDb({ ...RESTAURANT, status: "suspended" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    mocks.updateSubscriptionPreapproval.mockRejectedValue(new Error("recusou"));
    await expect(setRestaurantStatus(7, "active")).rejects.toMatchObject({ code: "BAD_GATEWAY", message: expect.stringContaining("Mercado Pago não aceitou a reativação") });
    expect(stub.updates).toHaveLength(0);
  });

  it("reativar a partir de cancelado: não chama o Mercado Pago (preapproval cancelada é definitiva)", async () => {
    const stub = buildDb({ ...RESTAURANT, status: "cancelled" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    await setRestaurantStatus(7, "active");
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
    expect(stub.updates[0].values).toMatchObject({ status: "active" });
  });

  it("restaurante já cancelado: não repete a chamada ao Mercado Pago", async () => {
    const stub = buildDb({ ...RESTAURANT, status: "cancelled" });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({}));
    await setRestaurantStatus(7, "cancelled");
    expect(mocks.updateSubscriptionPreapproval).not.toHaveBeenCalled();
  });
});

describe("markRestaurantDelivered", () => {
  it("em trial: devolve trialEndsAt, reinicia o período e o Telegram fala em teste grátis", async () => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({ status: "trial" }));
    const result = await markRestaurantDelivered(7, "platform_admin:x");
    expect(result.trialEndsAt).toBeGreaterThan(Date.now());
    expect(stub.updates.some(update => update.table === subscriptions)).toBe(true);
    expect(mocks.sendTelegramMessageAsync.mock.calls[0][0]).toContain("Teste grátis de 7 dias");
    expect(stub.inserts[0].eventType).toBe("delivered_trial_started");
  });

  it.each(["ended", "active"])("assinatura %s: trialEndsAt null, período intocado e sem promessa de teste grátis", async status => {
    const stub = buildDb(RESTAURANT);
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionForRestaurant.mockResolvedValue(subRow({ status }));
    const result = await markRestaurantDelivered(7, "platform_admin:x");
    expect(result.trialEndsAt).toBeNull();
    expect(stub.updates.some(update => update.table === subscriptions)).toBe(false);
    expect(mocks.sendTelegramMessageAsync.mock.calls[0][0]).not.toContain("Teste grátis de 7 dias");
    expect(mocks.sendTelegramMessageAsync.mock.calls[0][0]).toContain("Sem teste grátis");
    expect(stub.inserts[0].eventType).toBe("delivered");
  });
});

