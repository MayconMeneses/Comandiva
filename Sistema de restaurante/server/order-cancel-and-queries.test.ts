import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import type { TrpcContext } from "./_core/context";
import { payments } from "../drizzle/schema";

/**
 * Cobre 3 correções: cancelar pedido não apaga pagamento PAID; catalog.product
 * devolve NOT_FOUND (TRPCError) em vez de Error cru; getAdminOrders /
 * getActiveOrdersByPhone filtram no WHERE (antes do limit). Alertas/Telegram
 * sempre mockados — nenhum teste envia mensagem de verdade.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getProductDetail: vi.fn(),
  getDbClient: vi.fn(),
  sendOwnerAlert: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getOrderWithDetails: mocks.getOrderWithDetails,
  getAdminOrders: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getRevenueTrend: vi.fn(),
  getStoreSettings: vi.fn(),
  getProductDetail: mocks.getProductDetail,
}));
vi.mock("./db/client", async importOriginal => ({ ...(await importOriginal<typeof import("./db/client")>()), getDb: mocks.getDbClient }));
vi.mock("./_core/alerts", () => ({ sendOwnerAlert: mocks.sendOwnerAlert }));

import { adminOrdersRouter } from "./routers/admin/orders";
import { catalogRouter } from "./routers/catalog";
import { getActiveOrdersByPhone, getAdminOrders, markOrderPaymentPaidByPublicCode } from "./db/orders";

const dialect = new MySqlDialect();
const render = (cond: unknown) => dialect.sqlToQuery(cond as SQL);

const adminContext = {
  user: { id: 1, openId: "admin", name: "Admin", email: "a@test.local", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

describe("cancelar pedido preserva pagamento PAID", () => {
  beforeEach(() => vi.clearAllMocks());

  it("o UPDATE de payments só atinge PENDING/EXPIRED", async () => {
    const paymentWheres: unknown[] = [];
    const queryable = () => ({
      select: () => ({ from: () => ({ where: () => ({ limit: () => {
        const rows = [{ id: 10, status: "PENDING", fulfillmentType: "DELIVERY", paymentMethod: "PIX", paymentStatus: "PAID" }];
        return { for: async () => rows, then: (res: (v: unknown) => void) => Promise.resolve(rows).then(res) };
      } }) }) }),
      update: (table: unknown) => ({ set: () => ({ where: async (cond: unknown) => { if (table === payments) paymentWheres.push(cond); } }) }),
      insert: () => ({ values: async () => [{ insertId: 1 }] }),
    });
    mocks.getDb.mockResolvedValue({ ...queryable(), transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(queryable()) });
    mocks.getOrderWithDetails.mockResolvedValue({});

    await adminOrdersRouter.createCaller(adminContext).updateOrderStatus({ orderId: 10, status: "CANCELLED" });

    expect(paymentWheres).toHaveLength(1);
    const q = render(paymentWheres[0]);
    expect(q.sql).toMatch(/in \(/i);
    expect(q.params).toEqual(expect.arrayContaining(["PENDING", "EXPIRED"]));
    expect(q.params).not.toContain("PAID");
  });
});

describe("catalog.product", () => {
  it("produto inexistente vira NOT_FOUND, não erro interno", async () => {
    mocks.getProductDetail.mockResolvedValue(undefined);
    await expect(catalogRouter.createCaller({} as TrpcContext).product({ productId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Produto não encontrado" });
  });
});

function fakeSelectDb(rowsByCall: unknown[][] = []) {
  const wheres: unknown[] = [];
  let call = 0;
  const db = {
    select: () => ({ from: () => ({ where: (cond: unknown) => {
      wheres.push(cond);
      const rows = rowsByCall[call++] ?? [];
      const chain: Record<string, unknown> = {
        orderBy: () => chain,
        limit: () => chain,
        then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(rows).then(res, rej),
      };
      return chain;
    } }) }),
    update: () => ({ set: () => ({ where: async (cond: unknown) => { wheres.push(cond); } }) }),
  };
  return { db, wheres };
}

describe("filtros no WHERE antes do limit", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getAdminOrders exclui arquivados no WHERE", async () => {
    const { db, wheres } = fakeSelectDb();
    mocks.getDbClient.mockResolvedValue(db);
    await getAdminOrders({ limit: 50 });
    expect(render(wheres[0]).sql).toMatch(/archivedAt`? is null/i);
  });

  it("getActiveOrdersByPhone exclui COMPLETED/CANCELLED no WHERE", async () => {
    const { db, wheres } = fakeSelectDb();
    mocks.getDbClient.mockResolvedValue(db);
    await getActiveOrdersByPhone("11999999999");
    const q = render(wheres[0]);
    expect(q.sql).toMatch(/not in/i);
    expect(q.params).toEqual(expect.arrayContaining(["COMPLETED", "CANCELLED"]));
  });
});

describe("pagamento confirmado em pedido cancelado", () => {
  beforeEach(() => vi.clearAllMocks());
  const order = { id: 7, totalCents: 1000, paymentStatus: "PENDING" };

  it("alerta com o número do pedido quando o pagamento está CANCELLED", async () => {
    const { db } = fakeSelectDb([[order], [{ id: 3 }]]);
    mocks.getDbClient.mockResolvedValue(db);
    const res = await markOrderPaymentPaidByPublicCode("ABC", "ref-1", db as never);
    expect(res).toMatchObject({ found: true, orderId: 7 });
    expect(mocks.sendOwnerAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendOwnerAlert.mock.calls[0][1]).toContain("#7");
  });

  it("não alerta quando não há pagamento cancelado", async () => {
    const { db } = fakeSelectDb([[order], []]);
    await markOrderPaymentPaidByPublicCode("ABC", "ref-1", db as never);
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
  });
});
