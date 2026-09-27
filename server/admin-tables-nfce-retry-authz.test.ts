import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Achado de revisão de código: retryNfceForTableSession (força uma emissão
 * fiscal REAL de NFC-e pra comanda de mesa) usava tablesRestaurantProcedure
 * — liberado pra qualquer staff só com permissão de mesa — enquanto o
 * equivalente pra pedido normal (retryNfceForOrder, admin/orders.ts) sempre
 * exigiu adminProcedure. Mesma ação de compliance fiscal, dois níveis de
 * autorização diferentes. Corrigido: agora exige admin nos dois casos.
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);

const nfceMocks = vi.hoisted(() => ({ retryNfceForTableSession: vi.fn().mockResolvedValue(undefined) }));
vi.mock("./_core/nfceEmission", () => nfceMocks);

const dbMocks = vi.hoisted(() => ({ getFiscalDocumentByTableSessionId: vi.fn().mockResolvedValue({ id: 1, status: "AUTHORIZED" }) }));
vi.mock("./db", async importOriginal => ({ ...(await importOriginal<object>()), getFiscalDocumentByTableSessionId: dbMocks.getFiscalDocumentByTableSessionId }));

import { adminTablesRouter } from "./routers/admin/tables";

const UNLOCKED_SNAPSHOT = {
  planKey: "profissional",
  planName: "Profissional",
  status: "active",
  features: ["tables_qr"],
  limits: {},
  lockedFeatures: {},
  currentPeriodEnd: null,
  syncedAt: Date.now(),
  lastSyncOk: true,
};

function staffContext(): TrpcContext {
  return { user: { id: 1, role: "staff" }, supportSession: null, req: {}, res: {} } as unknown as TrpcContext;
}

function adminContext(): TrpcContext {
  return { user: { id: 2, role: "admin" }, supportSession: null, req: {}, res: {} } as unknown as TrpcContext;
}

describe("retryNfceForTableSession — mesmo nível de autorização do equivalente pra pedido (achado de revisão)", () => {
  it("staff só com permissão de mesa (sem ser admin) é rejeitado", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(UNLOCKED_SNAPSHOT);
    const caller = adminTablesRouter.createCaller(staffContext());

    await expect(caller.retryNfceForTableSession({ sessionId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(nfceMocks.retryNfceForTableSession).not.toHaveBeenCalled();
  });

  it("admin passa e a emissão é de fato chamada", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(UNLOCKED_SNAPSHOT);
    const caller = adminTablesRouter.createCaller(adminContext());

    await expect(caller.retryNfceForTableSession({ sessionId: 7 })).resolves.toEqual({ id: 1, status: "AUTHORIZED" });
    expect(nfceMocks.retryNfceForTableSession).toHaveBeenCalledWith(7);
  });
});
