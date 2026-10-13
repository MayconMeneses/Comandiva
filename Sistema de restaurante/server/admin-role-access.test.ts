import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getAdminOrders: vi.fn().mockResolvedValue([]),
  getDashboardMetrics: vi.fn().mockResolvedValue({ count: 0, revenueCents: 0, averageTicketCents: 0 }),
  getDeliveryRoutes: vi.fn().mockResolvedValue([]),
  getStoreSettings: vi.fn().mockResolvedValue({ isAcceptingOrders: true, estimatedDeliveryMin: 30, estimatedDeliveryMax: 50 }),
}));

vi.mock("./db", () => ({ ...mocks, getOrderWithDetails: vi.fn(), saveDeliveryRoute: vi.fn(), deleteDeliveryRoute: vi.fn() }));

import { adminRouter } from "./routers/admin";

const additionalAdminContext = {
  user: { id: 20, openId: "restaurant_admin_additional", name: "Admin auxiliar", email: null, loginMethod: "restaurant", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

describe("acesso do administrador adicional", () => {
  it("alcança os módulos centrais do painel", async () => {
    const orderResult = Object.assign(Promise.resolve([]), { limit: vi.fn().mockResolvedValue([]) });
    // admin.customers agora também roda uma contagem total em paralelo (bare
    // `await db.select({...}).from(x)`, sem orderBy/where) — `query` precisa
    // ser thenable (resolvendo pra 0) além de continuar oferecendo
    // orderBy/where pros outros endpoints (dashboard/catalog/orders/rotas)
    // que reaproveitam este mesmo mock.
    const query = Object.assign(Promise.resolve([{ count: 0 }]), { orderBy: vi.fn(() => orderResult), where: vi.fn(() => ({ orderBy: vi.fn(() => orderResult) })) });
    const select = vi.fn().mockReturnValue({ from: vi.fn(() => query) });
    mocks.getDb.mockResolvedValue({ select });
    const caller = adminRouter.createCaller(additionalAdminContext);

    await expect(caller.dashboard()).resolves.toEqual(expect.objectContaining({ count: 0, revenueCents: 0, recentOrders: [], settings: expect.anything() }));
    await expect(caller.customers({ limit: 10 })).resolves.toEqual({ rows: [], total: 0 });
    await expect(caller.catalog()).resolves.toEqual({ categories: [], products: [], addonGroups: [], addonOptions: [] });
    await expect(caller.orders({ limit: 10 })).resolves.toEqual([]);
    await expect(caller.deliveryRoutes()).resolves.toEqual([]);

    expect(mocks.getDashboardMetrics).toHaveBeenCalled();
    expect(mocks.getAdminOrders).toHaveBeenCalled();
    expect(mocks.getDeliveryRoutes).toHaveBeenCalled();
  });
});
