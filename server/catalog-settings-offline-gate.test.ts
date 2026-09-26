import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * offline_resilience virou recurso de plano (Profissional+, pedido do dono,
 * 2026-09-24) — antes rodava incondicional pra qualquer visitante. Prova que
 * catalog.settings (query PÚBLICA, já consultada por Checkout.tsx/
 * TableSession.tsx/NewCounterOrder.tsx) reflete o plano atual do deployment.
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);
vi.mock("./db", () => ({ getStoreSettingsCached: vi.fn().mockResolvedValue({ isAcceptingOrders: true, colorTheme: "default" }) }));

import { appRouter } from "./routers";

const publicContext = { user: null, req: { ip: "203.0.113.70", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

function snapshot(features: string[]) {
  return {
    planKey: "essencial",
    planName: "Essencial",
    status: "trial",
    features,
    limits: {},
    lockedFeatures: {},
    currentPeriodEnd: null,
    syncedAt: Date.now(),
    lastSyncOk: true,
  };
}

describe("catalog.settings — flag offlineResilienceEnabled", () => {
  it("plano com offline_resilience: settings devolve offlineResilienceEnabled true", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["offline_resilience"]));
    const caller = appRouter.createCaller(publicContext);

    const result = await caller.catalog.settings();
    expect(result.offlineResilienceEnabled).toBe(true);
    // O resto do settings continua vindo normalmente, sem perder nada.
    expect(result.isAcceptingOrders).toBe(true);
  });

  it("plano sem offline_resilience (ex.: Entrada): settings devolve offlineResilienceEnabled false", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot([]));
    const caller = appRouter.createCaller(publicContext);

    const result = await caller.catalog.settings();
    expect(result.offlineResilienceEnabled).toBe(false);
  });
});
