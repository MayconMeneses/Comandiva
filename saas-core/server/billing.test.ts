import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyMercadoPagoWebhookSignature } from "./_core/mercadoPagoBilling";

describe("verifyMercadoPagoWebhookSignature (saas-core)", () => {
  const secret = "test-secret";
  function sign(manifest: string) {
    return createHmac("sha256", secret).update(manifest).digest("hex");
  }

  it("aceita uma assinatura corretamente calculada", () => {
    const v1 = sign("id:abc;request-id:req-1;ts:1700000000000;");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "abc", secret })).toBe(true);
  });

  it("rejeita quando o secret não bate", () => {
    const v1 = sign("id:abc;request-id:req-1;ts:1700000000000;");
    expect(verifyMercadoPagoWebhookSignature({ xSignature: `ts=1700000000000,v1=${v1}`, xRequestId: "req-1", dataId: "abc", secret: "outro" })).toBe(false);
  });

  it("rejeita header ausente", () => {
    expect(verifyMercadoPagoWebhookSignature({ xSignature: undefined, xRequestId: "req-1", dataId: "abc", secret })).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getSubscriptionPreapproval: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/env", () => ({ ENV: { mercadoPagoAccessToken: "TEST-token", mercadoPagoWebhookSecret: "" } }));
// Mantém verifyMercadoPagoWebhookSignature e o resto REAIS (usados no describe
// acima) — só troca getSubscriptionPreapproval por um mock controlável, já
// que o teste de idempotência do webhook precisa simular estados diferentes
// (pending, depois authorized) pra MESMA preapproval.
vi.mock("./_core/mercadoPagoBilling", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/mercadoPagoBilling")>();
  return { ...actual, getSubscriptionPreapproval: mocks.getSubscriptionPreapproval };
});
// applyPreapprovalStatus continua com a implementação REAL (só embrulhada
// num vi.fn pra podermos contar quantas vezes foi chamada) — os describes
// abaixo que já testavam a implementação real continuam testando o
// comportamento real, sem quebrar.
vi.mock("./db/subscriptions", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/subscriptions")>();
  return { ...actual, applyPreapprovalStatus: vi.fn(actual.applyPreapprovalStatus) };
});

import { subscriptions, webhookEvents } from "../drizzle/schema";
import { handleMercadoPagoBillingWebhook } from "./_core/mercadoPagoWebhook";
import { applyPreapprovalStatus, recordBillingPayment } from "./db/subscriptions";

function dbStub(subscriptionRow: { id: number; restaurantId: number; status: string; gatewaySubscriptionId: string; gatewayCustomerId: string | null } | undefined, existingPayment?: unknown) {
  const insertValues = vi.fn();
  const updateSet = vi.fn(() => ({ where: vi.fn() }));
  let selectCallCount = 0;
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              selectCallCount++;
              // 1ª chamada = busca da subscription; 2ª (só em recordBillingPayment) = busca de pagamento existente.
              if (selectCallCount === 1) return subscriptionRow ? [subscriptionRow] : [];
              return existingPayment ? [existingPayment] : [];
            },
          }),
        }),
      }),
      update: () => ({ set: updateSet }),
      insert: () => ({ values: insertValues }),
    },
    updateSet,
    insertValues,
  };
}

describe("applyPreapprovalStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mapeia 'authorized' pra 'active' e grava evento quando o estado muda", async () => {
    const { db, updateSet } = dbStub({ id: 5, restaurantId: 2, status: "payment_pending", gatewaySubscriptionId: "pre-1", gatewayCustomerId: null });
    mocks.getDb.mockResolvedValue(db);
    const result = await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized", payerId: 999 });
    expect(result).toEqual({ found: true, applied: true, restaurantId: 2 });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "active", gatewayCustomerId: "999" }));
  });

  it("é idempotente — não reaplica nem grava evento se o status já é o mesmo", async () => {
    const { db, updateSet } = dbStub({ id: 5, restaurantId: 2, status: "active", gatewaySubscriptionId: "pre-1", gatewayCustomerId: "999" });
    mocks.getDb.mockResolvedValue(db);
    const result = await applyPreapprovalStatus({ preapprovalId: "pre-1", mpStatus: "authorized", payerId: 999 });
    expect(result).toEqual({ found: true, applied: false });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("devolve found:false quando nenhuma assinatura está vinculada a essa preapproval", async () => {
    const { db } = dbStub(undefined);
    mocks.getDb.mockResolvedValue(db);
    const result = await applyPreapprovalStatus({ preapprovalId: "pre-desconhecida", mpStatus: "authorized" });
    expect(result).toEqual({ found: false });
  });
});

describe("recordBillingPayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nunca grava duas vezes a mesma cobrança (idempotência por gatewayPaymentId)", async () => {
    const { db, insertValues } = dbStub({ id: 5, restaurantId: 2, status: "active", gatewaySubscriptionId: "pre-1", gatewayCustomerId: "999" }, { id: 1, gatewayPaymentId: "auth-1" });
    mocks.getDb.mockResolvedValue(db);
    const result = await recordBillingPayment({ preapprovalId: "pre-1", gatewayPaymentId: "auth-1", amountCents: 24990, mpStatus: "processed" });
    expect(result).toEqual({ found: true, duplicate: true });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("nunca marca como 'paid' sozinho — status do Mercado Pago é ambíguo demais pra decidir sucesso automaticamente", async () => {
    const { db, insertValues } = dbStub({ id: 5, restaurantId: 2, status: "active", gatewaySubscriptionId: "pre-1", gatewayCustomerId: "999" }, undefined);
    mocks.getDb.mockResolvedValue(db);
    await recordBillingPayment({ preapprovalId: "pre-1", gatewayPaymentId: "auth-2", amountCents: 24990, mpStatus: "processed" });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", paidAt: null }));
  });
});

/**
 * Banco fake que exercita a implementação REAL de applyPreapprovalStatus
 * (update de subscriptions + insert em subscriptionEvents via recordEvent) E
 * a implementação REAL de markWebhookEventOnce (insert em webhookEvents com a
 * mesma constraint única simulada: gateway+gatewayEventId duplicado lança
 * ER_DUP_ENTRY) — as duas usam a MESMA instância de `db`, exatamente como em
 * produção, então este é o teste que de fato prova o bug/a correção da chave
 * de dedup do webhook (não só de cada função isolada).
 */
function buildWebhookDbStub(initial: { id: number; restaurantId: number; status: string; gatewaySubscriptionId: string; gatewayCustomerId: string | null; scheduledPlanId?: number | null }) {
  let current: Record<string, unknown> = { scheduledPlanId: null, ...initial };
  const insertedWebhookKeys = new Set<string>();
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () => (table === subscriptions ? [current] : []),
        }),
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
        if (table === webhookEvents) {
          const key = `${values.gateway}:${values.gatewayEventId}`;
          if (insertedWebhookKeys.has(key)) {
            const duplicate = new Error("ER_DUP_ENTRY") as Error & { code?: string };
            duplicate.code = "ER_DUP_ENTRY";
            throw duplicate;
          }
          insertedWebhookKeys.add(key);
          return;
        }
        // insert em subscriptionEvents (recordEvent) — só precisa não explodir.
      },
    }),
  };
  return { db, getCurrent: () => current };
}

function fakeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as Response;
}

function fakeReq(dataId: string) {
  return { body: { type: "subscription_preapproval", data: { id: dataId } }, query: {}, header: () => undefined } as unknown as Request;
}

describe("handleMercadoPagoBillingWebhook — idempotência por transição de status (regressão do bug real)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("duas notificações com o MESMO preapprovalId mas status diferentes (pending -> authorized) aplicam a mudança NAS DUAS — assinatura não fica travada em payment_pending pra sempre", async () => {
    const stub = buildWebhookDbStub({ id: 5, restaurantId: 2, status: "trial", gatewaySubscriptionId: "pre-1", gatewayCustomerId: null });
    mocks.getDb.mockResolvedValue(stub.db);

    mocks.getSubscriptionPreapproval.mockResolvedValueOnce({ id: "pre-1", status: "pending", externalReference: null, payerId: null });
    await handleMercadoPagoBillingWebhook(fakeReq("pre-1"), fakeRes());
    expect(applyPreapprovalStatus).toHaveBeenCalledTimes(1);
    expect(stub.getCurrent().status).toBe("payment_pending");

    mocks.getSubscriptionPreapproval.mockResolvedValueOnce({ id: "pre-1", status: "authorized", externalReference: null, payerId: 999 });
    await handleMercadoPagoBillingWebhook(fakeReq("pre-1"), fakeRes());

    // A prova do bug corrigido: a SEGUNDA notificação (mesmo data.id da
    // primeira) não é descartada como duplicata — ela também chama
    // applyPreapprovalStatus e a assinatura de fato vira "active".
    expect(applyPreapprovalStatus).toHaveBeenCalledTimes(2);
    expect(stub.getCurrent().status).toBe("active");
  });

  it("a MESMA notificação repetida (retry idêntico do Mercado Pago: mesmo data.id, mesmo status) continua sendo descartada", async () => {
    const stub = buildWebhookDbStub({ id: 5, restaurantId: 2, status: "trial", gatewaySubscriptionId: "pre-1", gatewayCustomerId: null });
    mocks.getDb.mockResolvedValue(stub.db);
    mocks.getSubscriptionPreapproval.mockResolvedValue({ id: "pre-1", status: "authorized", externalReference: null, payerId: 999 });

    await handleMercadoPagoBillingWebhook(fakeReq("pre-1"), fakeRes());
    await handleMercadoPagoBillingWebhook(fakeReq("pre-1"), fakeRes());

    expect(applyPreapprovalStatus).toHaveBeenCalledTimes(1);
  });
});
