import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre o fluxo de cobrança mensal recusada (2026-09-17, pedido do dono):
 * avisar no Telegram quando a mensalidade fica pendente, dar 5 dias de
 * prazo antes de bloquear o acesso, e avisar de novo quando recuperar ou
 * quando o Mercado Pago cancelar de vez. A distinção central: "recycling"
 * (Mercado Pago tentando cobrar de novo) NUNCA pode adiantar
 * currentPeriodEnd — diferente do fluxo normal de renovação.
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", mercadoPagoWebhookSecret: "", isProduction: false } }));

import { subscriptions, subscriptionEvents, restaurants } from "../drizzle/schema";
import { applyPreapprovalStatus, isPastDueGraceExpired, markSubscriptionPastDue } from "./db/subscriptions";

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/** Banco fake stateful — só as tabelas que este fluxo realmente toca. */
function buildFakeDb(subscriptionRow: Record<string, unknown>) {
  let current = { restaurantId: 2, scheduledPlanId: null, ...subscriptionRow };
  const events: Array<{ subscriptionId: number; eventType: string; createdAt: number }> = [];

  const db = {
    select: (columns?: unknown) => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === subscriptionEvents) {
            // isPastDueGraceExpired lê a lista inteira sem .limit().
            return Promise.resolve(events.filter(event => event.subscriptionId === current.id));
          }
          return {
            limit: async () => {
              if (table === subscriptions) return [current];
              if (table === restaurants) return columns ? [{ name: "Restaurante Teste", contactName: null, contactEmail: null }] : [];
              return [];
            },
          };
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          if (table === subscriptions) current = { ...current, ...values };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === subscriptionEvents) events.push({ subscriptionId: values.subscriptionId as number, eventType: values.eventType as string, createdAt: values.createdAt as number });
      },
    }),
  };
  return { db, getCurrent: () => current, getEvents: () => events };
}

describe("markSubscriptionPastDue", () => {
  beforeEach(() => vi.clearAllMocks());

  it("de 'active' vira 'past_due' com pastDueSince marcado agora", async () => {
    const stub = buildFakeDb({ id: 5, status: "active", pastDueSince: null });
    mocks.getDb.mockResolvedValue(stub.db);
    const before = Date.now();

    await markSubscriptionPastDue(5);

    expect(stub.getCurrent().status).toBe("past_due");
    expect(stub.getCurrent().pastDueSince).toBeGreaterThanOrEqual(before);
    expect(stub.getEvents().some(e => e.eventType === "payment_recycling")).toBe(true);
  });

  it("idempotente — chamar de novo já em past_due NÃO reinicia a contagem dos 5 dias", async () => {
    const oldTimestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // já past_due há 3 dias
    const stub = buildFakeDb({ id: 5, status: "past_due", pastDueSince: oldTimestamp });
    mocks.getDb.mockResolvedValue(stub.db);

    await markSubscriptionPastDue(5);

    expect(stub.getCurrent().pastDueSince).toBe(oldTimestamp);
    expect(stub.getEvents()).toHaveLength(0);
  });

  it("nunca marca past_due a partir de um status que não seja 'active' (ex: trial, cancelado)", async () => {
    const stub = buildFakeDb({ id: 5, status: "trial", pastDueSince: null });
    mocks.getDb.mockResolvedValue(stub.db);

    await markSubscriptionPastDue(5);

    expect(stub.getCurrent().status).toBe("trial");
  });
});

describe("isPastDueGraceExpired", () => {
  beforeEach(() => vi.clearAllMocks());

  it("false quando o status não é past_due", async () => {
    mocks.getDb.mockResolvedValue(buildFakeDb({ id: 5, status: "active", pastDueSince: null }).db);
    const expired = await isPastDueGraceExpired({ id: 5, status: "active", pastDueSince: null, restaurantId: 2 });
    expect(expired).toBe(false);
  });

  it("false quando past_due há menos de 5 dias", async () => {
    const pastDueSince = Date.now() - 2 * 24 * 60 * 60 * 1000;
    mocks.getDb.mockResolvedValue(buildFakeDb({ id: 5, status: "past_due", pastDueSince }).db);
    const expired = await isPastDueGraceExpired({ id: 5, status: "past_due", pastDueSince, restaurantId: 2 });
    expect(expired).toBe(false);
  });

  it("true e registra o evento quando passou de 5 dias", async () => {
    const pastDueSince = Date.now() - FIVE_DAYS_MS - 1000;
    const stub = buildFakeDb({ id: 5, status: "past_due", pastDueSince });
    mocks.getDb.mockResolvedValue(stub.db);

    const expired = await isPastDueGraceExpired({ id: 5, status: "past_due", pastDueSince, restaurantId: 2 });

    expect(expired).toBe(true);
    expect(stub.getEvents().filter(e => e.eventType === "past_due_grace_expired")).toHaveLength(1);
  });

  it("chamado de novo (ex: a cada poll) não registra o evento uma segunda vez", async () => {
    const pastDueSince = Date.now() - FIVE_DAYS_MS - 1000;
    const stub = buildFakeDb({ id: 5, status: "past_due", pastDueSince });
    mocks.getDb.mockResolvedValue(stub.db);

    await isPastDueGraceExpired({ id: 5, status: "past_due", pastDueSince, restaurantId: 2 });
    await isPastDueGraceExpired({ id: 5, status: "past_due", pastDueSince, restaurantId: 2 });

    expect(stub.getEvents().filter(e => e.eventType === "past_due_grace_expired")).toHaveLength(1);
  });
});

describe("applyPreapprovalStatus — recuperação a partir de past_due", () => {
  beforeEach(() => vi.clearAllMocks());

  it("volta pra 'active' e limpa pastDueSince quando o Mercado Pago confirma 'authorized' de novo", async () => {
    const stub = buildFakeDb({ id: 5, status: "past_due", pastDueSince: Date.now() - 86400000, gatewaySubscriptionId: "pre-1", gatewayCustomerId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    const result = await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized", payerId: 999 });

    expect(result).toMatchObject({ found: true, applied: true });
    expect(stub.getCurrent().status).toBe("active");
    expect(stub.getCurrent().pastDueSince).toBeNull();
  });
});
