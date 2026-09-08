import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * `markPaymentRefunded` só é permitido a partir de status PAID (nunca de
 * PENDING/CANCELLED/já REFUNDED) e sempre grava quem, quando e o motivo —
 * tanto em `payments` quanto em `orderChangeLogs` (auditoria por pedido).
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getOrderWithDetails: vi.fn(),
}));

vi.mock("./db", () => ({
  ...mocks,
  getAdminOrders: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getStoreSettings: vi.fn(),
}));

import { appRouter } from "./routers";

const adminContext = {
  user: { id: 7, openId: "admin", name: "Admin", email: null, loginMethod: "local", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

function dbReturning(paymentRow: { id: number; orderId: number; status: string; amountCents: number } | undefined) {
  const insertValues = vi.fn();
  const updateSet = vi.fn(() => ({ where: vi.fn() }));
  return {
    db: {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => (paymentRow ? [paymentRow] : []) }) }) }),
      update: () => ({ set: updateSet }),
      insert: () => ({ values: insertValues }),
    },
    updateSet,
    insertValues,
  };
}

describe("admin.markPaymentRefunded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrderWithDetails.mockResolvedValue({ id: 1 });
  });

  it("recusa quando não existe pagamento para o pedido", async () => {
    const { db } = dbReturning(undefined);
    mocks.getDb.mockResolvedValue(db);
    await expect(appRouter.createCaller(adminContext).admin.markPaymentRefunded({ orderId: 1, reason: "Cliente desistiu" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("recusa reembolsar um pagamento que ainda não foi pago (PENDING)", async () => {
    const { db, updateSet } = dbReturning({ id: 10, orderId: 1, status: "PENDING", amountCents: 5000 });
    mocks.getDb.mockResolvedValue(db);
    await expect(appRouter.createCaller(adminContext).admin.markPaymentRefunded({ orderId: 1, reason: "Cliente desistiu" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("recusa reembolsar um pagamento já reembolsado antes", async () => {
    const { db, updateSet } = dbReturning({ id: 10, orderId: 1, status: "REFUNDED", amountCents: 5000 });
    mocks.getDb.mockResolvedValue(db);
    await expect(appRouter.createCaller(adminContext).admin.markPaymentRefunded({ orderId: 1, reason: "Cliente desistiu" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("recusa motivo vazio/curto demais antes de tocar no banco", async () => {
    mocks.getDb.mockResolvedValue(dbReturning({ id: 10, orderId: 1, status: "PAID", amountCents: 5000 }).db);
    await expect(appRouter.createCaller(adminContext).admin.markPaymentRefunded({ orderId: 1, reason: "a" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("registra o estorno quando o pagamento está PAID: atualiza payments e grava orderChangeLogs", async () => {
    const { db, updateSet, insertValues } = dbReturning({ id: 10, orderId: 1, status: "PAID", amountCents: 5000 });
    mocks.getDb.mockResolvedValue(db);
    const result = await appRouter.createCaller(adminContext).admin.markPaymentRefunded({ orderId: 1, reason: "Cliente desistiu do pedido" });
    expect(result).toEqual({ id: 1 });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "REFUNDED", refundedByUserId: 7, refundReason: "Cliente desistiu do pedido" }));
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, changedByUserId: 7, changeType: "PAYMENT_REFUNDED" }));
  });
});
