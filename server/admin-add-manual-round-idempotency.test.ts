import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Fase B do offline-first do painel admin (ver plano em
 * C:\Users\maico\.claude\plans\curried-sprouting-wirth.md): `admin.addManualRound`
 * ganhou um `operationId`, repassado como `clientOperationId` pra
 * `addRoundToTable` — o mesmo mecanismo de dedupe já provado a fundo em
 * server/order-create-idempotency.test.ts e server/order-idempotency-real-db.test.ts
 * (via insertPricedOrder). Este teste prova só a fiação NOVA (o procedure
 * repassa o campo certo), sem reprovar o dedupe em si — `addRoundToTable` é
 * mockado como caixa-preta.
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);

const tableMocks = vi.hoisted(() => ({ addRoundToTable: vi.fn() }));
vi.mock("./routers/table", async importOriginal => {
  const actual = await importOriginal<typeof import("./routers/table")>();
  return { ...actual, addRoundToTable: tableMocks.addRoundToTable };
});

import { appRouter } from "./routers";

const staffContext = { user: { id: 1, role: "staff" }, req: { ip: "203.0.113.61", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

function snapshot(features: string[]) {
  return {
    planKey: "profissional",
    planName: "Profissional",
    status: "active",
    features,
    limits: {},
    lockedFeatures: {},
    currentPeriodEnd: null,
    syncedAt: Date.now(),
    lastSyncOk: true,
  };
}

const BASE_INPUT = { tableId: 1, items: [{ productId: 1, quantity: 1, addonOptionIds: [] }], operationId: "test-round-op-1" };

describe("admin.addManualRound — repasse do operationId (Fase B offline-first)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("chama addRoundToTable com clientOperationId = input.operationId e origin GARCOM", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr", "extra_rounds"]));
    tableMocks.addRoundToTable.mockResolvedValue({ orderId: 1, code: "ABC", sessionId: 1, totalCents: 1000 });
    const caller = appRouter.createCaller(staffContext);

    await caller.admin.addManualRound(BASE_INPUT);

    expect(tableMocks.addRoundToTable).toHaveBeenCalledWith(expect.objectContaining({ tableId: 1, origin: "GARCOM", clientOperationId: "test-round-op-1" }));
  });

  it("operationId ausente falha a validação Zod antes de chegar em addRoundToTable", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr", "extra_rounds"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.addManualRound({ tableId: 1, items: BASE_INPUT.items } as never)).rejects.toThrow();
    expect(tableMocks.addRoundToTable).not.toHaveBeenCalled();
  });

  it("sem a feature extra_rounds no plano: bloqueado antes de chegar em addRoundToTable", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.addManualRound(BASE_INPUT)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(tableMocks.addRoundToTable).not.toHaveBeenCalled();
  });
});
