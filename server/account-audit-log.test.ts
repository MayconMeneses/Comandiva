import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Cobre o gap identificado na auditoria de segurança (achado M1): criar/
 * pausar/excluir conta de equipe, trocar credencial de gateway de pagamento
 * ou a chave Pix não deixava rastro nenhum. Confirma tanto que a auditoria é
 * gravada quanto — igualmente importante — que ela NUNCA inclui o valor de
 * uma senha/credencial, só o fato de que mudou.
 */
const mocks = vi.hoisted(() => ({
  recordAccountAudit: vi.fn().mockResolvedValue(undefined),
  create: vi.fn().mockResolvedValue({ id: 10, userId: 20, name: "Nova Conta", username: "nova.conta", role: "staff", active: true }),
  update: vi.fn().mockResolvedValue({ success: true }),
  setActive: vi.fn().mockResolvedValue({ success: true }),
  remove: vi.fn().mockResolvedValue({ success: true }),
  getStoredStaffPermissions: vi.fn().mockResolvedValue([]),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    recordAccountAudit: mocks.recordAccountAudit,
    createRestaurantAccessAccount: mocks.create,
    updateRestaurantAccessAccount: mocks.update,
    setRestaurantAccessAccountActive: mocks.setActive,
    deleteRestaurantAccessAccount: mocks.remove,
    getStoredStaffPermissions: mocks.getStoredStaffPermissions,
  };
});

const { appRouter } = await import("./routers");

const adminContext = {
  user: { id: 1, openId: "owner", name: "Dono", email: "dono@teste.com", loginMethod: "local", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {}, ip: "203.0.113.10" },
  res: { cookie: vi.fn() },
} as unknown as TrpcContext;

describe("auditoria de conta — team.*", () => {
  it("team.create grava auditoria sem incluir a senha", async () => {
    await appRouter.createCaller(adminContext).team.create({ name: "Nova Conta", username: "nova.conta", password: "senha-super-secreta", role: "staff" });

    expect(mocks.recordAccountAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.created", entityType: "user", entityId: 20 }));
    const call = mocks.recordAccountAudit.mock.calls.at(-1)![0];
    expect(JSON.stringify(call)).not.toContain("senha-super-secreta");
  });

  it("team.update grava auditoria sem incluir a senha, só o fato de que mudou", async () => {
    await appRouter.createCaller(adminContext).team.update({ accountId: 10, name: "Nome Novo", password: "outra-senha-secreta" });

    const call = mocks.recordAccountAudit.mock.calls.at(-1)![0];
    expect(call).toMatchObject({ action: "team.updated", entityType: "user", entityId: 10, after: { passwordChanged: true } });
    expect(JSON.stringify(call)).not.toContain("outra-senha-secreta");
  });

  it("team.setActive(false) grava 'team.paused'", async () => {
    await appRouter.createCaller(adminContext).team.setActive({ accountId: 10, active: false });
    expect(mocks.recordAccountAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.paused", entityId: 10 }));
  });

  it("team.setActive(true) grava 'team.reactivated'", async () => {
    await appRouter.createCaller(adminContext).team.setActive({ accountId: 10, active: true });
    expect(mocks.recordAccountAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.reactivated", entityId: 10 }));
  });

  it("team.delete grava auditoria", async () => {
    await appRouter.createCaller(adminContext).team.delete({ accountId: 10 });
    expect(mocks.recordAccountAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.deleted", entityType: "user", entityId: 10 }));
  });
});

describe("auditoria de conta — paymentGateways.*", () => {
  function dbStub() {
    const insertValues = vi.fn(async () => [{ insertId: 55 }]);
    const updateSet = vi.fn(() => ({ where: vi.fn() }));
    const deleteWhere = vi.fn();
    return {
      db: {
        select: () => ({ from: () => ({ orderBy: async () => [] }) }),
        insert: () => ({ values: insertValues }),
        update: () => ({ set: updateSet }),
        delete: () => ({ where: deleteWhere }),
      },
      insertValues,
      updateSet,
      deleteWhere,
    };
  }

  it("savePaymentGateway (criação): grava auditoria com apiKeyChanged/secretKeyChanged, NUNCA o valor real", async () => {
    vi.doMock("./db", async importOriginal => {
      const actual = await importOriginal<typeof import("./db")>();
      const stub = dbStub();
      return { ...actual, getDb: async () => stub.db, recordAccountAudit: mocks.recordAccountAudit };
    });
    vi.resetModules();
    const { appRouter: freshRouter } = await import("./routers");
    mocks.recordAccountAudit.mockClear();

    await freshRouter.createCaller(adminContext).admin.savePaymentGateway({ provider: "MERCADO_PAGO", label: "Mercado Pago", apiKey: "chave-secreta-real", secretKey: "outro-segredo-real" });

    const call = mocks.recordAccountAudit.mock.calls.at(-1)![0];
    expect(call).toMatchObject({ action: "paymentGateway.created", entityType: "paymentGateway", after: { apiKeyChanged: true, secretKeyChanged: true } });
    expect(JSON.stringify(call)).not.toContain("chave-secreta-real");
    expect(JSON.stringify(call)).not.toContain("outro-segredo-real");

    vi.doUnmock("./db");
    vi.resetModules();
  });
});
