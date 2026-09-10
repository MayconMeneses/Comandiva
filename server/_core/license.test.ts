import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobertura que faltava (auditoria V-12): a sincronização com o saas-core
 * nunca validava o formato da resposta em runtime (só um `as {...}` cru) —
 * um formato inesperado batia direto num `snapshot.features.includes()` (ou
 * pior) em algum request completamente diferente, bem depois, sem nenhum
 * teste cobrindo esse caminho. Agora a resposta passa por
 * `syncSnapshotResponseSchema.parse()` — os testes abaixo provam que um
 * formato malformado cai no mesmo fail-open de qualquer outra falha de
 * rede, sem derrubar o boot nem corromper o cache local.
 */
const mocks = vi.hoisted(() => ({
  getOrCreateLicenseCache: vi.fn().mockResolvedValue({ lastSyncOk: false }),
  getLocalUsageCounts: vi.fn(),
  upsertLicenseCache: vi.fn(),
}));

vi.mock("../db", () => mocks);
// licenseSyncIntervalMs bem alto: evita que o setInterval real do módulo
// (disparado no import, ver o `if` no fim de license.ts) atrapalhe o teste.
vi.mock("./env", () => ({ ENV: { saasCoreUrl: "https://saas-core.test", saasCoreApiKey: "test-key", licenseSyncIntervalMs: 999_999_999 } }));

const validSnapshotBody = {
  result: {
    data: {
      planKey: "premium",
      planName: "Premium",
      status: "active",
      features: ["tables_qr"],
      limits: { users: 10, tables: null },
      lockedFeatures: {},
      currentPeriodEnd: 1_999_999_999_000,
      scheduledPlanKey: null,
      scheduledPlanName: null,
    },
  },
};

// fetch mockado ANTES do import — o próprio módulo dispara uma sincronização
// automática no carregamento (linha final de license.ts) quando as env vars
// acima estão preenchidas; sem isso o import lançaria sobre `fetch` inexistente.
global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => validSnapshotBody });
const { forceSyncLicense } = await import("./license");

describe("sincronização de licença com o saas-core", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOrCreateLicenseCache.mockResolvedValue({ lastSyncOk: false });
  });

  it("resposta válida: valida com o schema e grava o cache", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => validSnapshotBody });

    await forceSyncLicense();

    expect(mocks.upsertLicenseCache).toHaveBeenCalledWith(expect.objectContaining({
      planKey: "premium",
      planName: "Premium",
      currentPeriodEnd: 1_999_999_999_000,
    }));
  });

  it("resposta malformada (campo obrigatório ausente): não grava o cache, não derruba o processo", async () => {
    const malformed = { result: { data: { planKey: "premium" /* faltam os outros campos obrigatórios */ } } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => malformed });

    await expect(forceSyncLicense()).resolves.not.toThrow();
    expect(mocks.upsertLicenseCache).not.toHaveBeenCalled();
  });

  it("resposta com tipo errado (features não é array): não grava o cache", async () => {
    const wrongType = { result: { data: { ...validSnapshotBody.result.data, features: "tables_qr" } } };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => wrongType });

    await forceSyncLicense();
    expect(mocks.upsertLicenseCache).not.toHaveBeenCalled();
  });

  it("HTTP não-ok: fail-open, não grava o cache", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await forceSyncLicense();
    expect(mocks.upsertLicenseCache).not.toHaveBeenCalled();
  });
});

describe("buildSnapshot — fail-open (via forceSyncLicense, sem sincronização bem-sucedida)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
  });

  it("sem linha nenhuma no cache: libera tudo (permissivo)", async () => {
    mocks.getOrCreateLicenseCache.mockResolvedValue(undefined);
    const snapshot = await forceSyncLicense();
    expect(snapshot.features).toContain("tables_qr");
    expect(snapshot.lastSyncOk).toBe(false);
  });

  it("linha existe mas nunca sincronizou de verdade (lastSyncOk false): também libera tudo", async () => {
    mocks.getOrCreateLicenseCache.mockResolvedValue({ lastSyncOk: false, featuresJson: "[]" });
    const snapshot = await forceSyncLicense();
    expect(snapshot.features).toContain("tables_qr");
  });
});
