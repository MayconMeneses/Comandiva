import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Prova o novo gate de permissão granular pra staff (ver
 * server/_core/permissions.ts, server/_core/trpc.ts::restaurantProcedureFor):
 * uma conta staff só alcança uma área extra (ex.: "customers") se ela
 * estiver na lista de permissões dela no banco — nunca por causa da role
 * "staff" sozinha. Sem nenhuma permissão, staff continua exatamente como
 * sempre foi: só pedidos/mesas (fora do escopo deste teste, já coberto em
 * team-access.test.ts/admin-access.test.ts).
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getStaffPermissionsByUserId: vi.fn(),
}));

vi.mock("./db/users", async importOriginal => {
  const actual = await importOriginal<typeof import("./db/users")>();
  return { ...actual, getStaffPermissionsByUserId: mocks.getStaffPermissionsByUserId };
});
vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: mocks.getDb };
});

import { adminCustomersRouter } from "./routers/admin/customers";

function staffContext(userId: number): TrpcContext {
  return { user: { id: userId, role: "staff" } as unknown as TrpcContext["user"], supportSession: null, req: {}, res: {} } as unknown as TrpcContext;
}

describe("restaurantProcedureFor — permissão granular de staff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const rows = [{ id: 1, name: "Cliente" }];
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })) })) })) });
  });

  it("staff sem nenhuma permissão extra é rejeitado", async () => {
    mocks.getStaffPermissionsByUserId.mockResolvedValue([]);
    const caller = adminCustomersRouter.createCaller(staffContext(1));
    await expect(caller.customers({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("staff com a área errada liberada (catalog, não customers) continua rejeitado", async () => {
    mocks.getStaffPermissionsByUserId.mockResolvedValue(["catalog"]);
    const caller = adminCustomersRouter.createCaller(staffContext(2));
    await expect(caller.customers({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("staff com a área certa liberada (customers) passa", async () => {
    mocks.getStaffPermissionsByUserId.mockResolvedValue(["customers"]);
    const caller = adminCustomersRouter.createCaller(staffContext(3));
    await expect(caller.customers({ limit: 10 })).resolves.toEqual([{ id: 1, name: "Cliente" }]);
    expect(mocks.getStaffPermissionsByUserId).toHaveBeenCalledWith(3);
  });

  it("checa a permissão pelo id de quem chamou, não de uma conta staff qualquer (isolamento entre contas)", async () => {
    mocks.getStaffPermissionsByUserId.mockImplementation(async (userId: number) => (userId === 5 ? ["customers"] : []));
    await expect(adminCustomersRouter.createCaller(staffContext(4)).customers({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(adminCustomersRouter.createCaller(staffContext(5)).customers({ limit: 10 })).resolves.toEqual([{ id: 1, name: "Cliente" }]);
  });
});
