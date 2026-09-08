import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("./db", () => mocks);

import { adminRouter } from "./routers/admin";

const adminContext = {
  user: { id: 7, openId: "promo-admin", name: "Admin", email: "admin@pubx.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

describe("validação de preço promocional (produtos vinculados)", () => {
  const selectWhere = vi.fn(); const from = vi.fn(); const select = vi.fn();
  const insertValues = vi.fn(); const insert = vi.fn();
  const deleteWhere = vi.fn(); const del = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // select(...).from(products).where(inArray(...)) -> linha de cada produto
    selectWhere.mockResolvedValue([{ id: 12, priceCents: 3990 }]);
    from.mockReturnValue({ where: selectWhere }); select.mockReturnValue({ from });
    insertValues.mockResolvedValue([{ insertId: 99 }]); insert.mockReturnValue({ values: insertValues });
    deleteWhere.mockResolvedValue(undefined); del.mockReturnValue({ where: deleteWhere });
    mocks.getDb.mockResolvedValue({ select, insert, delete: del });
  });

  it("rejeita preço promocional maior ou igual à soma do preço normal dos produtos", async () => {
    await expect(adminRouter.createCaller(adminContext).savePromotion({
      title: "Combo do dia", productIds: [12], promoPriceCents: 3990, active: true, sortOrder: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(adminRouter.createCaller(adminContext).savePromotion({
      title: "Combo do dia", productIds: [12], promoPriceCents: 4200, active: true, sortOrder: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita preço promocional menor que a soma do preço normal dos produtos", async () => {
    const result = await adminRouter.createCaller(adminContext).savePromotion({
      title: "Combo do dia", productIds: [12], promoPriceCents: 2990, active: true, sortOrder: 0,
    });
    expect(result).toEqual({ id: 99 });
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ promoPriceCents: 2990 }));
  });

  it("valida a soma de vários produtos vinculados (combo)", async () => {
    selectWhere.mockResolvedValue([{ id: 12, priceCents: 3990 }, { id: 13, priceCents: 1200 }]);
    await expect(adminRouter.createCaller(adminContext).savePromotion({
      title: "Combo duplo", productIds: [12, 13], promoPriceCents: 5190, active: true, sortOrder: 0,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const result = await adminRouter.createCaller(adminContext).savePromotion({
      title: "Combo duplo", productIds: [12, 13], promoPriceCents: 4500, active: true, sortOrder: 0,
    });
    expect(result).toEqual({ id: 99 });
  });

  it("não exige preço promocional quando informado", async () => {
    const result = await adminRouter.createCaller(adminContext).savePromotion({
      title: "Promoção sem desconto informado", productIds: [12], active: true, sortOrder: 0,
    });
    expect(result).toEqual({ id: 99 });
  });

  it("rejeita promoção sem nenhum produto vinculado", async () => {
    await expect(adminRouter.createCaller(adminContext).savePromotion({
      title: "Promoção vazia", productIds: [], active: true, sortOrder: 0,
    })).rejects.toBeTruthy();
  });
});
