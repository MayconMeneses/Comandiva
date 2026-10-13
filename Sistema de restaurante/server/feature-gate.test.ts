import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Prova que o bloqueio por plano acontece no BACKEND (não só escondido no
 * frontend): com a feature fora do plano atual, a mutation rejeita com
 * FORBIDDEN + featureLocked antes de qualquer lógica de negócio rodar; com a
 * feature liberada, a chamada passa do gate (e falha só por outro motivo
 * de negócio, provando que passou).
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);
vi.mock("./db", () => ({ findTableByToken: vi.fn().mockResolvedValue(undefined) }));

import { appRouter } from "./routers";

const publicContext = { user: null, req: { ip: "203.0.113.50", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

const LOCKED_SNAPSHOT = {
  planKey: "essencial",
  planName: "Essencial",
  status: "trial",
  features: [],
  limits: {},
  lockedFeatures: { extra_rounds: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } },
  currentPeriodEnd: null,
  syncedAt: Date.now(),
  lastSyncOk: true,
};

const UNLOCKED_SNAPSHOT = { ...LOCKED_SNAPSHOT, features: ["extra_rounds"], lockedFeatures: {} };

describe("gate de feature por plano (table.addRound)", () => {
  it("bloqueia com FEATURE_LOCKED quando o plano atual não inclui a feature", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(LOCKED_SNAPSHOT);
    const caller = appRouter.createCaller(publicContext);

    await expect(
      caller.table.addRound({ token: "mesa-teste-123", items: [{ productId: 1, quantity: 1, addonOptionIds: [] }], operationId: "test-operation-id-locked" }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { featureLocked: { featureId: "extra_rounds", requiredPlanKey: "profissional", requiredPlanName: "Profissional" } },
    });
  });

  it("não bloqueia por plano quando a feature está incluída (passa do gate, falha só depois por outro motivo)", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(UNLOCKED_SNAPSHOT);
    const caller = appRouter.createCaller(publicContext);

    const error = await caller.table.addRound({ token: "mesa-teste-456", items: [{ productId: 1, quantity: 1, addonOptionIds: [] }], operationId: "test-operation-id-unlocked" }).catch(caught => caught);
    expect(error).not.toMatchObject({ code: "FORBIDDEN", cause: { featureLocked: expect.anything() } });
    // findTableByToken mockado devolve undefined -> a rota real segue até NOT_FOUND, provando que passou do gate de plano.
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });
});
