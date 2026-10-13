import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Achado numa varredura (2026-09-24): operationalSnapshot (server/routers/
 * admin/operations.ts) é consultado por 3 telas gateadas de formas
 * diferentes NO CLIENTE (RestaurantOrders.tsx/Kitchen.tsx checam
 * lockedFeatures.kitchen; TablesAdmin.tsx checa lockedFeatures.tables_qr),
 * mas o procedure em si não tinha nenhum requireFeature — qualquer conta
 * autenticada, mesmo num plano sem nenhuma das duas features, conseguia
 * chamar isto direto (fora da UI) e ler pedidos/mesas/chamados de garçom.
 * Prova aqui que o gate agora acontece no BACKEND, igual ao padrão já usado
 * em server/feature-gate.test.ts.
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);
vi.mock("./db", () => ({
  getAdminOrders: vi.fn().mockResolvedValue([]),
  listTablesWithOpenSessions: vi.fn().mockResolvedValue([]),
  listPendingServiceRequests: vi.fn().mockResolvedValue([]),
}));

import { appRouter } from "./routers";

const staffContext = { user: { id: 1, role: "staff" }, req: { ip: "203.0.113.60", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

function snapshot(features: string[]) {
  return {
    planKey: "essencial",
    planName: "Essencial",
    status: "trial",
    features,
    limits: {},
    lockedFeatures: { kitchen: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } },
    currentPeriodEnd: null,
    syncedAt: Date.now(),
    lastSyncOk: true,
  };
}

describe("gate de feature por plano (admin.operationalSnapshot)", () => {
  it("bloqueia com FEATURE_LOCKED quando o plano não tem kitchen NEM tables_qr", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot([]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.operationalSnapshot()).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { featureLocked: { featureId: "kitchen", requiredPlanKey: "profissional", requiredPlanName: "Profissional" } },
    });
  });

  it("passa quando o plano tem só kitchen (sem tables_qr)", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["kitchen"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.operationalSnapshot()).resolves.toMatchObject({ orders: [], tables: [], pendingServiceRequests: [] });
  });

  it("passa quando o plano tem só tables_qr (sem kitchen) — o outro consumidor legítimo (TablesAdmin.tsx)", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.operationalSnapshot()).resolves.toMatchObject({ orders: [], tables: [], pendingServiceRequests: [] });
  });
});
