import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(), getAdminOrders: vi.fn(), getDashboardMetrics: vi.fn(), getDeliveryRoutes: vi.fn(),
  getOrderWithDetails: vi.fn(), getStoreSettings: vi.fn(), saveDeliveryRoute: vi.fn(), deleteDeliveryRoute: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { adminRouter } from "./routers/admin";

const adminContext = {
  user: { id: 7, openId: "catalog-admin", name: "Admin", email: "admin@pubx.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

describe("consulta administrativa do catálogo", () => {
  const select = vi.fn(); const productWhere = vi.fn(); const productOrderBy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const productsInDatabase = [
      { id: 8, categoryId: 1, name: "Produto ativo", archivedAt: null },
      { id: 9, categoryId: 1, name: "Produto arquivado", archivedAt: 1_700_000_000_000 },
    ];
    productOrderBy.mockResolvedValue(productsInDatabase.filter(product => product.archivedAt === null));
    productWhere.mockReturnValue({ orderBy: productOrderBy });
    select
      .mockReturnValueOnce({ from: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([{ id: 1, name: "Lanches" }]) })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: productWhere })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })) });
    mocks.getDb.mockResolvedValue({ select });
  });

  it("aplica o filtro de arquivamento antes de retornar os produtos ao painel", async () => {
    const catalog = await adminRouter.createCaller(adminContext).catalog();
    expect(productWhere).toHaveBeenCalledTimes(1);
    expect(catalog.products).toEqual([{ id: 8, categoryId: 1, name: "Produto ativo", archivedAt: null }]);
    expect(catalog.products).not.toContainEqual(expect.objectContaining({ id: 9, name: "Produto arquivado" }));
  });
});
