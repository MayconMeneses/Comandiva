import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Atendente (staff) sem a permissão "relatórios" só vê pedidos das últimas 24 h
 * (auditoria 2026-10-10, decisão do dono). Admin, Modo Suporte e staff COM
 * "relatórios" continuam vendo todo o histórico.
 */
const mocks = vi.hoisted(() => ({
  getAdminOrders: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getStaffPermissionsByUserId: vi.fn(),
  listTablesWithOpenSessions: vi.fn().mockResolvedValue([]),
  listPendingServiceRequests: vi.fn().mockResolvedValue([]),
}));

vi.mock("./db", () => ({
  getAdminOrders: mocks.getAdminOrders,
  getOrderWithDetails: mocks.getOrderWithDetails,
  getStaffPermissionsByUserId: mocks.getStaffPermissionsByUserId,
  listTablesWithOpenSessions: mocks.listTablesWithOpenSessions,
  listPendingServiceRequests: mocks.listPendingServiceRequests,
}));
vi.mock("./db/users", () => ({ getStaffPermissionsByUserId: mocks.getStaffPermissionsByUserId }));
vi.mock("./_core/license", () => ({ getLicenseSnapshot: vi.fn().mockResolvedValue({ features: ["kitchen", "tables_qr"] }) }));

import { STAFF_ORDER_WINDOW_MS, getOrderHistoryFloor } from "./_core/orderHistoryWindow";
import { appRouter } from "./routers";

const NOW = 1_800_000_000_000;
const user = (role: "admin" | "staff") => ({ id: 5, openId: "u5", name: "U", email: null, loginMethod: "restaurant", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
const ctxFor = (overrides: Partial<TrpcContext>) => ({ user: null, supportSession: null, req: { ip: "203.0.113.5" }, res: {}, ...overrides }) as unknown as TrpcContext;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminOrders.mockResolvedValue([]);
  mocks.getStaffPermissionsByUserId.mockResolvedValue([]);
  mocks.listTablesWithOpenSessions.mockResolvedValue([]);
  mocks.listPendingServiceRequests.mockResolvedValue([]);
});

describe("getOrderHistoryFloor", () => {
  it("admin e Modo Suporte: sem limite", async () => {
    expect(await getOrderHistoryFloor(ctxFor({ user: user("admin") as never }), NOW)).toBeUndefined();
    expect(await getOrderHistoryFloor(ctxFor({ supportSession: { supportSessionId: 1 } as never }), NOW)).toBeUndefined();
  });

  it("staff com a permissão relatórios: sem limite", async () => {
    mocks.getStaffPermissionsByUserId.mockResolvedValue(["reports"]);
    expect(await getOrderHistoryFloor(ctxFor({ user: user("staff") as never }), NOW)).toBeUndefined();
  });

  it("staff sem relatórios: últimas 24 horas", async () => {
    expect(await getOrderHistoryFloor(ctxFor({ user: user("staff") as never }), NOW)).toBe(NOW - STAFF_ORDER_WINDOW_MS);
  });
});

describe("admin.orders / orderDetail / operationalSnapshot para o atendente", () => {
  it("orders: período pedido é cortado em 24 h, mesmo pedindo desde o começo dos tempos", async () => {
    const before = Date.now();
    await appRouter.createCaller(ctxFor({ user: user("staff") as never })).admin.orders({ startAt: 1, limit: 100 });
    const { startAt } = mocks.getAdminOrders.mock.calls[0][0];
    expect(startAt).toBeGreaterThanOrEqual(before - STAFF_ORDER_WINDOW_MS - 5);
    expect(startAt).toBeLessThanOrEqual(Date.now() - STAFF_ORDER_WINDOW_MS + 5);
  });

  it("orders: sem período informado, também ganha o corte de 24 h", async () => {
    await appRouter.createCaller(ctxFor({ user: user("staff") as never })).admin.orders();
    expect(mocks.getAdminOrders.mock.calls[0][0].startAt).toBeGreaterThan(Date.now() - STAFF_ORDER_WINDOW_MS - 1000);
  });

  it("orders: admin passa o período como pediu, sem corte", async () => {
    await appRouter.createCaller(ctxFor({ user: user("admin") as never })).admin.orders({ startAt: 1, limit: 10 });
    expect(mocks.getAdminOrders.mock.calls[0][0].startAt).toBe(1);
  });

  it("orderDetail: pedido de 3 dias atrás vira 'não encontrado' pro atendente, mas o de 1 hora aparece", async () => {
    const caller = appRouter.createCaller(ctxFor({ user: user("staff") as never }));
    mocks.getOrderWithDetails.mockResolvedValueOnce({ id: 1, createdAt: Date.now() - 3 * 24 * 3600_000 });
    await expect(caller.admin.orderDetail({ orderId: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    mocks.getOrderWithDetails.mockResolvedValueOnce({ id: 2, createdAt: Date.now() - 3600_000 });
    await expect(caller.admin.orderDetail({ orderId: 2 })).resolves.toMatchObject({ id: 2 });
  });

  it("orderDetail: admin vê pedido antigo", async () => {
    mocks.getOrderWithDetails.mockResolvedValueOnce({ id: 1, createdAt: Date.now() - 90 * 24 * 3600_000 });
    await expect(appRouter.createCaller(ctxFor({ user: user("admin") as never })).admin.orderDetail({ orderId: 1 })).resolves.toMatchObject({ id: 1 });
  });

  it("operationalSnapshot (painel de pedidos): só as últimas 24 h pro atendente", async () => {
    await appRouter.createCaller(ctxFor({ user: user("staff") as never })).admin.operationalSnapshot();
    expect(mocks.getAdminOrders.mock.calls[0][0].startAt).toBeGreaterThan(Date.now() - STAFF_ORDER_WINDOW_MS - 1000);
  });
});
