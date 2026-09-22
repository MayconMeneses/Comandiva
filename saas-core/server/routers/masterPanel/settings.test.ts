import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";
import { GRANTABLE_MASTER_AREAS } from "../../_core/permissions";

/**
 * Aparência do Painel Master — leitura aberta a qualquer admin logado
 * (precisa aplicar o tema pra todo mundo), escrita travada pela área
 * "aparencia" (owner sempre passa, member só com a área concedida). Mesmo
 * padrão de controle de acesso de maintenance-permission.test.ts.
 */
const mocks = vi.hoisted(() => ({
  getMasterPanelSettings: vi.fn(),
  setMasterPanelBackgroundColor: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/masterPanelSettings", () => ({
  getMasterPanelSettings: mocks.getMasterPanelSettings,
  setMasterPanelBackgroundColor: mocks.setMasterPanelBackgroundColor,
}));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { masterPanelSettingsRouter } from "./settings";

function platformAdminContext(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[]; active: boolean } | undefined): TrpcContext {
  return { platformAdmin: admin, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

const UNAUTHENTICATED = platformAdminContext(undefined);
const MEMBER_WITHOUT_APARENCIA = platformAdminContext({ id: 101, email: "membro1@plataforma.com", role: "member", permissions: ["restaurantes"], active: true });
const MEMBER_WITH_APARENCIA = platformAdminContext({ id: 102, email: "membro2@plataforma.com", role: "member", permissions: ["aparencia"], active: true });
const OWNER = platformAdminContext({ id: 100, email: "dono@plataforma.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS], active: true });

describe("masterPanelSettingsRouter.getAppearance — leitura aberta a qualquer admin logado", () => {
  it("exige sessão válida (401 sem platformAdmin)", async () => {
    const caller = masterPanelSettingsRouter.createCaller(UNAUTHENTICATED);
    await expect(caller.getAppearance()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("member SEM a área 'aparencia' ainda consegue ler (precisa aplicar o tema)", async () => {
    mocks.getMasterPanelSettings.mockResolvedValue({ id: 1, backgroundColor: "#0b1220", updatedAt: 0 });
    const caller = masterPanelSettingsRouter.createCaller(MEMBER_WITHOUT_APARENCIA);
    await expect(caller.getAppearance()).resolves.toEqual({ id: 1, backgroundColor: "#0b1220", updatedAt: 0 });
  });

  it("owner consegue ler", async () => {
    mocks.getMasterPanelSettings.mockResolvedValue({ id: 1, backgroundColor: null, updatedAt: 0 });
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.getAppearance()).resolves.toEqual({ id: 1, backgroundColor: null, updatedAt: 0 });
  });
});

describe("masterPanelSettingsRouter.updateAppearance — escrita travada pela área 'aparencia'", () => {
  it("exige sessão válida (401 sem platformAdmin)", async () => {
    const caller = masterPanelSettingsRouter.createCaller(UNAUTHENTICATED);
    await expect(caller.updateAppearance({ backgroundColor: "#0b1220" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("member SEM a área 'aparencia' é barrado com FORBIDDEN, sem persistir nada", async () => {
    mocks.setMasterPanelBackgroundColor.mockClear();
    const caller = masterPanelSettingsRouter.createCaller(MEMBER_WITHOUT_APARENCIA);
    await expect(caller.updateAppearance({ backgroundColor: "#0b1220" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setMasterPanelBackgroundColor).not.toHaveBeenCalled();
  });

  it("member COM a área 'aparencia' consegue salvar", async () => {
    mocks.setMasterPanelBackgroundColor.mockResolvedValue({ success: true });
    const caller = masterPanelSettingsRouter.createCaller(MEMBER_WITH_APARENCIA);
    await expect(caller.updateAppearance({ backgroundColor: "#0b1220" })).resolves.toEqual({ success: true });
  });

  it("owner sempre consegue salvar", async () => {
    mocks.setMasterPanelBackgroundColor.mockResolvedValue({ success: true });
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.updateAppearance({ backgroundColor: "#0b1220" })).resolves.toEqual({ success: true });
  });

  it("normaliza o hex pra minúsculo antes de persistir", async () => {
    mocks.setMasterPanelBackgroundColor.mockClear();
    mocks.setMasterPanelBackgroundColor.mockResolvedValue({ success: true });
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await caller.updateAppearance({ backgroundColor: "#0B1220" });
    expect(mocks.setMasterPanelBackgroundColor).toHaveBeenCalledWith("#0b1220");
  });

  it("aceita null (restaurar padrão)", async () => {
    mocks.setMasterPanelBackgroundColor.mockClear();
    mocks.setMasterPanelBackgroundColor.mockResolvedValue({ success: true });
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.updateAppearance({ backgroundColor: null })).resolves.toEqual({ success: true });
    expect(mocks.setMasterPanelBackgroundColor).toHaveBeenCalledWith(null);
  });

  it("rejeita hex sem #", async () => {
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.updateAppearance({ backgroundColor: "0b1220" } as never)).rejects.toBeTruthy();
  });

  it("rejeita hex com tamanho errado", async () => {
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.updateAppearance({ backgroundColor: "#0b12" } as never)).rejects.toBeTruthy();
  });

  it("rejeita hex com caracteres inválidos", async () => {
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await expect(caller.updateAppearance({ backgroundColor: "#zzzzzz" } as never)).rejects.toBeTruthy();
  });

  it("grava auditoria com o valor salvo", async () => {
    mocks.recordPlatformAuditLog.mockClear();
    mocks.setMasterPanelBackgroundColor.mockResolvedValue({ success: true });
    const caller = masterPanelSettingsRouter.createCaller(OWNER);
    await caller.updateAppearance({ backgroundColor: "#0b1220" });
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorAdminId: 100,
      actorLabel: "dono@plataforma.com",
      action: "appearance.updated",
      after: { backgroundColor: "#0b1220" },
    }));
  });
});
