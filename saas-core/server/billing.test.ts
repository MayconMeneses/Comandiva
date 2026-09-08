import { createHmac } from "node:crypto";
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

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

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
