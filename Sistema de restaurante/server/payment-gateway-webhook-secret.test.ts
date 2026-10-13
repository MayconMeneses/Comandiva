import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Auditoria 2026-10-10: Mercado Pago só pode ser ATIVADO com a "chave secreta"
 * do webhook preenchida — sem ela as confirmações de pagamento são recusadas
 * (antes eram aceitas sem assinatura).
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), recordAccountAudit: vi.fn().mockResolvedValue(undefined), updates: [] as unknown[] }));
vi.mock("./db", () => ({ getDb: mocks.getDb, recordAccountAudit: mocks.recordAccountAudit }));

import { appRouter } from "./routers";

const admin = {
  user: { id: 1, openId: "restaurant_admin", name: "Admin", email: null, loginMethod: "restaurant", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  supportSession: null,
  req: { ip: "203.0.113.5" },
  res: {},
} as unknown as TrpcContext;

function dbWithGateway(row: { provider: string; secretKey: string | null } | undefined) {
  return {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (row ? [row] : []) }) }) }),
    update: () => ({ set: (values: unknown) => { mocks.updates.push(values); return { where: async () => undefined, then: (resolve: (v: unknown) => void) => resolve(undefined) }; } }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updates.length = 0;
});

describe("admin.setActivePaymentGateway — chave secreta do webhook", () => {
  it("recusa ativar Mercado Pago sem a chave secreta e não altera nada", async () => {
    mocks.getDb.mockResolvedValue(dbWithGateway({ provider: "MERCADO_PAGO", secretKey: null }));
    await expect(appRouter.createCaller(admin).admin.setActivePaymentGateway({ id: 1, active: true })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("chave secreta") });
    expect(mocks.updates).toHaveLength(0);
  });

  it("ativa Mercado Pago quando a chave secreta já está preenchida", async () => {
    mocks.getDb.mockResolvedValue(dbWithGateway({ provider: "MERCADO_PAGO", secretKey: "segredo" }));
    await expect(appRouter.createCaller(admin).admin.setActivePaymentGateway({ id: 1, active: true })).resolves.toEqual({ success: true });
    expect(mocks.updates.length).toBeGreaterThan(0);
  });

  it("desativar nunca exige a chave (não trava quem quer desligar)", async () => {
    mocks.getDb.mockResolvedValue(dbWithGateway({ provider: "MERCADO_PAGO", secretKey: null }));
    await expect(appRouter.createCaller(admin).admin.setActivePaymentGateway({ id: 1, active: false })).resolves.toEqual({ success: true });
  });

  it("gateway que não é Mercado Pago ativa normalmente (não tem webhook automático)", async () => {
    mocks.getDb.mockResolvedValue(dbWithGateway({ provider: "PAGSEGURO", secretKey: null }));
    await expect(appRouter.createCaller(admin).admin.setActivePaymentGateway({ id: 2, active: true })).resolves.toEqual({ success: true });
  });
});
