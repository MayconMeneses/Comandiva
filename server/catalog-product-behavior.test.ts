import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getAdminOrders: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getDeliveryRoutes: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getStoreSettings: vi.fn(),
  saveDeliveryRoute: vi.fn(),
  deleteDeliveryRoute: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { adminRouter } from "./routers/admin";

const adminContext = {
  user: { id: 7, openId: "catalog-admin", name: "Admin", email: "admin@pubx.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

describe("operações administrativas de produto", () => {
  const set = vi.fn(); const where = vi.fn(); const update = vi.fn(); const limit = vi.fn(); const selectWhere = vi.fn(); const from = vi.fn(); const select = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    where.mockResolvedValue(undefined); set.mockReturnValue({ where }); update.mockReturnValue({ set });
    limit.mockResolvedValue([{ id: 42 }]); selectWhere.mockReturnValue({ limit }); from.mockReturnValue({ where: selectWhere }); select.mockReturnValue({ from });
    mocks.getDb.mockResolvedValue({ select, update });
  });

  it("persiste as alterações informadas para um produto existente", async () => {
    const result = await adminRouter.createCaller(adminContext).saveProduct({ id: 42, categoryId: 3, name: "Produto atualizado", description: "Descrição atualizada", imageUrl: "/assets/pubx/produto.jpg", priceCents: 2590, preparationMinutes: 18, available: true, featured: true, sortOrder: 4 });
    expect(result).toEqual({ id: 42 });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ name: "Produto atualizado", priceCents: 2590, imageUrl: "/assets/pubx/produto.jpg" }));
  });

  it("arquiva a exclusão e remove o produto das consultas ativas", async () => {
    const result = await adminRouter.createCaller(adminContext).deleteProduct({ productId: 42 });
    expect(result).toEqual({ success: true });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ available: false, archivedAt: expect.any(Number) }));
    expect(selectWhere).toHaveBeenCalledTimes(1);
  });
});
