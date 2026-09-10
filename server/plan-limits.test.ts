import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quota do plano (PROMPT MESTRE §23/§25) — bloqueia CRIAR mais um recurso
 * quando o plano já está no limite, nunca apaga nada existente. Ver
 * server/routers/team.ts::create/setActive e server/routers/admin/tables.ts::createTable/updateTable.
 */
const mocks = vi.hoisted(() => ({
  getLicenseSnapshot: vi.fn(),
  getLicenseUsage: vi.fn(),
  getLocalUsageCounts: vi.fn(),
  lockLicenseSingletonRow: vi.fn(),
  getDb: vi.fn(),
}));
vi.mock("./_core/license", () => ({ getLicenseSnapshot: mocks.getLicenseSnapshot, getLicenseUsage: mocks.getLicenseUsage }));
vi.mock("./db/license", () => ({ getLocalUsageCounts: mocks.getLocalUsageCounts, lockLicenseSingletonRow: mocks.lockLicenseSingletonRow }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

import { assertWithinPlanLimit, assertWithinPlanLimitAndInsert } from "./_core/planLimits";

describe("assertWithinPlanLimit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite quando o uso está abaixo do limite", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Essencial", limits: { users: 5 } });
    mocks.getLicenseUsage.mockResolvedValue({ users: 3, tables: 0 });
    await expect(assertWithinPlanLimit("users")).resolves.toBeUndefined();
  });

  it("bloqueia quando o uso já bateu no limite", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Essencial", limits: { users: 5 } });
    mocks.getLicenseUsage.mockResolvedValue({ users: 5, tables: 0 });
    await expect(assertWithinPlanLimit("users")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bloqueia quando o uso já passou do limite (ex.: sobrou de um downgrade)", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Essencial", limits: { tables: 10 } });
    mocks.getLicenseUsage.mockResolvedValue({ users: 0, tables: 12 });
    await expect(assertWithinPlanLimit("tables")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sem limite configurado (null) = ilimitado, sempre permite", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Premium", limits: { users: null } });
    mocks.getLicenseUsage.mockResolvedValue({ users: 9999, tables: 0 });
    await expect(assertWithinPlanLimit("users")).resolves.toBeUndefined();
  });
});

/**
 * assertWithinPlanLimitAndInsert fecha a corrida check-then-act de
 * assertWithinPlanLimit (auditoria V-24): checagem + inserção rodam dentro
 * da mesma transação, serializadas por lockLicenseSingletonRow — duas
 * chamadas concorrentes disputam esse lock sequencialmente, então a segunda
 * só reconta depois que a primeira já terminou. Aqui não dá pra provar o
 * lock de verdade (isso é garantia do MySQL, não de unit test com mock),
 * mas dá pra provar a ORDEM certa: trava antes de contar, conta antes de
 * decidir, e só insere depois de passar no limite — se essa ordem estiver
 * errada, a trava não protege nada mesmo com o SQL certo.
 */
describe("assertWithinPlanLimitAndInsert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sem limite configurado: chama insert direto, sem transação nem lock", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Premium", limits: { users: null } });
    const insert = vi.fn().mockResolvedValue({ id: 1 });
    await expect(assertWithinPlanLimitAndInsert("users", insert)).resolves.toEqual({ id: 1 });
    expect(insert).toHaveBeenCalledWith();
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.lockLicenseSingletonRow).not.toHaveBeenCalled();
  });

  it("com limite e uso abaixo dele: trava, reconta dentro da transação, e insere", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Essencial", limits: { users: 5 } });
    const fakeTx = { marker: "tx" };
    mocks.getDb.mockResolvedValue({ transaction: async (fn: (tx: unknown) => unknown) => fn(fakeTx) });
    mocks.getLocalUsageCounts.mockResolvedValue({ users: 3, tables: 0 });
    const insert = vi.fn().mockResolvedValue({ id: 42 });
    const order: string[] = [];
    mocks.lockLicenseSingletonRow.mockImplementation(async () => { order.push("lock"); });
    mocks.getLocalUsageCounts.mockImplementation(async () => { order.push("count"); return { users: 3, tables: 0 }; });

    await expect(assertWithinPlanLimitAndInsert("users", insert)).resolves.toEqual({ id: 42 });
    expect(insert).toHaveBeenCalledWith(fakeTx);
    expect(order).toEqual(["lock", "count"]); // lock sempre antes da contagem, senão não protege nada
  });

  it("com limite já atingido dentro da transação: rejeita e NUNCA chama insert", async () => {
    mocks.getLicenseSnapshot.mockResolvedValue({ planName: "Essencial", limits: { users: 5 } });
    mocks.getDb.mockResolvedValue({ transaction: async (fn: (tx: unknown) => unknown) => fn({}) });
    mocks.getLocalUsageCounts.mockResolvedValue({ users: 5, tables: 0 });
    const insert = vi.fn();

    await expect(assertWithinPlanLimitAndInsert("users", insert)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.lockLicenseSingletonRow).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
