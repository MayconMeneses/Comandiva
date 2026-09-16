import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Prova o grandfather clause do tema de cor (custom_theme, feature paga):
 * o gate trava só a TROCA pra um tema novo não-padrão — nunca reenviar o
 * mesmo valor já salvo, nunca voltar pro "classico", mesmo com o plano
 * atual sem a feature (ex.: depois de um downgrade). Mesmo raciocínio já
 * usado em catalog.ts::saveProduct (promotions) e team.ts (advanced_team).
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getStoreSettings: vi.fn(),
  getLicenseSnapshot: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb, getStoreSettings: mocks.getStoreSettings }));
vi.mock("./_core/license", () => ({ getLicenseSnapshot: mocks.getLicenseSnapshot }));

import { adminRouter } from "./routers/admin";

const adminContext = {
  user: { id: 1, openId: "theme-admin", name: "Admin", email: "admin@pubx.test", loginMethod: "local", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {}, res: {},
} as unknown as TrpcContext;

const BASE_INPUT = {
  isAcceptingOrders: true,
  deliveryFeeCents: 700,
  minimumOrderCents: 1500,
  estimatedDeliveryMin: 30,
  estimatedDeliveryMax: 50,
  openingHours: "Hoje, 18h às 23h",
};

const LOCKED_SNAPSHOT = {
  planKey: "essencial",
  planName: "Essencial",
  status: "active",
  features: [] as string[],
  limits: {},
  lockedFeatures: { custom_theme: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } },
  currentPeriodEnd: null,
  syncedAt: Date.now(),
  lastSyncOk: true,
};
const UNLOCKED_SNAPSHOT = { ...LOCKED_SNAPSHOT, features: ["custom_theme"], lockedFeatures: {} };

describe("admin.updateSettings — colorTheme respeita o gate de plano só na troca pra um tema novo", () => {
  const setWhere = vi.fn();
  const set = vi.fn();
  const update = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setWhere.mockResolvedValue(undefined);
    set.mockReturnValue({ where: setWhere });
    update.mockReturnValue({ set });
    mocks.getDb.mockResolvedValue({ update });
  });

  it("bloqueia trocar pra um tema pago quando o plano atual não inclui custom_theme", async () => {
    mocks.getStoreSettings.mockResolvedValue({ id: 1, colorTheme: "classico" });
    mocks.getLicenseSnapshot.mockResolvedValue(LOCKED_SNAPSHOT);

    await expect(
      adminRouter.createCaller(adminContext).updateSettings({ ...BASE_INPUT, colorTheme: "azul" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", cause: { featureLocked: { featureId: "custom_theme" } } });
    expect(setWhere).not.toHaveBeenCalled();
  });

  it("permite trocar pra um tema pago quando o plano inclui custom_theme", async () => {
    mocks.getStoreSettings.mockResolvedValue({ id: 1, colorTheme: "classico" });
    mocks.getLicenseSnapshot.mockResolvedValue(UNLOCKED_SNAPSHOT);

    await expect(
      adminRouter.createCaller(adminContext).updateSettings({ ...BASE_INPUT, colorTheme: "azul" }),
    ).resolves.toEqual({ success: true });
  });

  it("nunca bloqueia voltar pro tema classico, mesmo sem o plano incluir custom_theme", async () => {
    mocks.getStoreSettings.mockResolvedValue({ id: 1, colorTheme: "azul" });
    mocks.getLicenseSnapshot.mockResolvedValue(LOCKED_SNAPSHOT);

    await expect(
      adminRouter.createCaller(adminContext).updateSettings({ ...BASE_INPUT, colorTheme: "classico" }),
    ).resolves.toEqual({ success: true });
  });

  it("nunca bloqueia reenviar o mesmo tema pago já salvo (downgrade de plano não quebra configuração existente)", async () => {
    mocks.getStoreSettings.mockResolvedValue({ id: 1, colorTheme: "azul" });
    mocks.getLicenseSnapshot.mockResolvedValue(LOCKED_SNAPSHOT);

    await expect(
      adminRouter.createCaller(adminContext).updateSettings({ ...BASE_INPUT, colorTheme: "azul" }),
    ).resolves.toEqual({ success: true });
  });

  it("não checa o gate quando colorTheme nem é enviado (outros campos do formulário)", async () => {
    mocks.getStoreSettings.mockResolvedValue({ id: 1, colorTheme: "classico" });
    mocks.getLicenseSnapshot.mockResolvedValue(LOCKED_SNAPSHOT);

    await expect(adminRouter.createCaller(adminContext).updateSettings(BASE_INPUT)).resolves.toEqual({ success: true });
    expect(mocks.getLicenseSnapshot).not.toHaveBeenCalled();
  });
});
