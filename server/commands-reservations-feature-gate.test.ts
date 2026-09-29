import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * `commands`/`reservations` eram featureIds "fantasma" no catálogo de
 * planos — vendidos, mas nunca checados por ninguém (nem frontend nem
 * backend), só pegando carona no gate de `tables_qr` por estarem sempre no
 * mesmo plano hoje. Prova que o backend agora exige a feature específica
 * pra cada grupo de endpoints (closeSession/cancelSession/reopenSession/
 * recordBillPayment → commands; reservations/createReservation/
 * updateReservation → reservations), mesmo padrão já usado em
 * operational-snapshot-feature-gate.test.ts.
 */
const licenseMocks = vi.hoisted(() => ({ getLicenseSnapshot: vi.fn() }));
vi.mock("./_core/license", () => licenseMocks);
vi.mock("./db", () => ({
  closeTableSession: vi.fn().mockResolvedValue({ id: 1 }),
  createReservation: vi.fn().mockResolvedValue(1),
}));

import { appRouter } from "./routers";

const staffContext = { user: { id: 1, role: "staff" }, req: { ip: "203.0.113.61", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;

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

describe("gate de feature por plano — commands (admin.closeSession)", () => {
  it("bloqueia com FEATURE_LOCKED quando o plano tem tables_qr mas NÃO commands", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.closeSession({ sessionId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { featureLocked: { featureId: "commands" } },
    });
  });

  it("bloqueia também sem tables_qr nenhum (falha na primeira checagem da cadeia)", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot([]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.closeSession({ sessionId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("passa quando o plano tem tables_qr E commands (hoje sempre vendidos juntos)", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr", "commands"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.closeSession({ sessionId: 1 })).resolves.toMatchObject({ id: 1 });
  });
});

describe("gate de feature por plano — reservations (admin.createReservation)", () => {
  const reservationInput = { customerName: "Ana", customerPhone: "85999991234", partySize: 2, reservedFor: Date.now() + 3_600_000 };

  it("bloqueia com FEATURE_LOCKED quando o plano tem tables_qr mas NÃO reservations", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.createReservation(reservationInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
      cause: { featureLocked: { featureId: "reservations" } },
    });
  });

  it("passa quando o plano tem tables_qr E reservations", async () => {
    licenseMocks.getLicenseSnapshot.mockResolvedValue(snapshot(["tables_qr", "reservations"]));
    const caller = appRouter.createCaller(staffContext);

    await expect(caller.admin.createReservation(reservationInput)).resolves.toMatchObject({ id: 1 });
  });
});
