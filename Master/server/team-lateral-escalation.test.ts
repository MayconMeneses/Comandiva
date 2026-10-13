import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

/**
 * Escalação LATERAL entre members (auditoria): quem não é owner só pode mexer
 * (senha, nome, permissões, pausar/reativar) em conta cujas permissões sejam
 * um SUBCONJUNTO das suas. Sem isso, um member com ["equipe"] trocava a senha
 * de outro member com ["equipe","billing"] e assumia o acesso a billing.
 */
const mocks = vi.hoisted(() => ({
  getPlatformAdminById: vi.fn(),
  setPlatformAdminActive: vi.fn(),
  updatePlatformAdmin: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db/platformAdmins", () => ({
  createPlatformAdmin: vi.fn(),
  getPlatformAdminById: mocks.getPlatformAdminById,
  listPlatformAdmins: vi.fn(),
  setPlatformAdminActive: mocks.setPlatformAdminActive,
  updatePlatformAdmin: mocks.updatePlatformAdmin,
}));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { masterPanelTeamRouter } from "./routers/masterPanel/team";

function ctxFor(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[] }): TrpcContext {
  return { platformAdmin: { ...admin, active: true }, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

const MEMBER_WITH_EQUIPE = ctxFor({ id: 2, email: "membro@plataforma.com", role: "member", permissions: ["equipe"] });
const OWNER = ctxFor({ id: 1, email: "dono@plataforma.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS] });

const target = (overrides: Record<string, unknown>) => ({ role: "member", active: true, passwordHash: "x", totpSecret: null, createdAt: 0, updatedAt: 0, ...overrides });
const SAME_AREAS = target({ id: 3, name: "Mesmas Áreas", email: "igual@plataforma.com", permissions: ["equipe"] });
const MORE_AREAS = target({ id: 5, name: "Mais Áreas", email: "mais@plataforma.com", permissions: ["equipe", "billing"] });

describe("team.update — alvo com MAIS áreas que o ator", () => {
  it("troca de senha é barrada com FORBIDDEN, sem tocar no banco nem na auditoria", async () => {
    mocks.getPlatformAdminById.mockResolvedValue(MORE_AREAS);
    mocks.updatePlatformAdmin.mockClear();
    mocks.recordPlatformAuditLog.mockClear();

    await expect(masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE).update({ adminId: 5, name: "Mais Áreas", password: "novaSenha123" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringContaining("subconjunto"),
    });
    expect(mocks.updatePlatformAdmin).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("até só renomear é barrado", async () => {
    mocks.getPlatformAdminById.mockResolvedValue(MORE_AREAS);
    mocks.updatePlatformAdmin.mockClear();
    await expect(masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE).update({ adminId: 5, name: "Outro Nome" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updatePlatformAdmin).not.toHaveBeenCalled();
  });

  it("alvo com as mesmas áreas (subconjunto) é permitido", async () => {
    mocks.getPlatformAdminById.mockResolvedValue(SAME_AREAS);
    mocks.updatePlatformAdmin.mockClear().mockResolvedValue(undefined);
    await expect(masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE).update({ adminId: 3, name: "Mesmas Áreas", password: "novaSenha123" })).resolves.toMatchObject({ success: true });
    expect(mocks.updatePlatformAdmin).toHaveBeenCalled();
  });

  it("owner continua podendo tudo", async () => {
    mocks.getPlatformAdminById.mockResolvedValue(MORE_AREAS);
    mocks.updatePlatformAdmin.mockClear().mockResolvedValue(undefined);
    await expect(masterPanelTeamRouter.createCaller(OWNER).update({ adminId: 5, name: "Mais Áreas", password: "novaSenha123" })).resolves.toMatchObject({ success: true });
  });
});

describe("team.setActive — alvo com MAIS áreas que o ator", () => {
  it("pausar é barrado com FORBIDDEN", async () => {
    mocks.getPlatformAdminById.mockResolvedValue(MORE_AREAS);
    mocks.setPlatformAdminActive.mockClear();
    await expect(masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE).setActive({ adminId: 5, active: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setPlatformAdminActive).not.toHaveBeenCalled();
  });

  it("alvo com as mesmas áreas é permitido, e owner pode tudo", async () => {
    mocks.setPlatformAdminActive.mockClear().mockResolvedValue(undefined);
    mocks.getPlatformAdminById.mockResolvedValue(SAME_AREAS);
    await expect(masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE).setActive({ adminId: 3, active: false })).resolves.toMatchObject({ success: true });
    mocks.getPlatformAdminById.mockResolvedValue(MORE_AREAS);
    await expect(masterPanelTeamRouter.createCaller(OWNER).setActive({ adminId: 5, active: false })).resolves.toMatchObject({ success: true });
  });
});
