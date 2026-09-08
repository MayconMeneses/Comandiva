import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Quota do plano (PROMPT MESTRE §23/§25) — bloqueia CRIAR mais um recurso
 * quando o plano já está no limite, nunca apaga nada existente. Ver
 * server/routers/team.ts::create/setActive e server/routers/admin/tables.ts::createTable/updateTable.
 */
const mocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn(), getLicenseUsage: vi.fn() }));
vi.mock("./_core/license", () => ({ getLicenseSnapshot: mocks.getLicenseSnapshot, getLicenseUsage: mocks.getLicenseUsage }));

import { assertWithinPlanLimit } from "./_core/planLimits";

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
