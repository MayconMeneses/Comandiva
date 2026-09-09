import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

/**
 * Prova a correção da escalação de privilégio crítica: um platform admin
 * "member" com a área "equipe" liberada (permissão pra gerenciar quem mais
 * entra no Painel Master) NÃO pode criar uma conta "owner" (acesso total
 * irrestrito) chamando team.create com { role: "owner" } — só uma conta que
 * já é "owner" pode criar outra "owner". `update` nunca mexe em `role` (nem
 * aceita esse campo no input), então não precisa do mesmo teste.
 */
const mocks = vi.hoisted(() => ({
  createPlatformAdmin: vi.fn(),
  getPlatformAdminById: vi.fn(),
  listPlatformAdmins: vi.fn(),
  setPlatformAdminActive: vi.fn(),
  updatePlatformAdmin: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db/platformAdmins", () => ({
  createPlatformAdmin: mocks.createPlatformAdmin,
  getPlatformAdminById: mocks.getPlatformAdminById,
  listPlatformAdmins: mocks.listPlatformAdmins,
  setPlatformAdminActive: mocks.setPlatformAdminActive,
  updatePlatformAdmin: mocks.updatePlatformAdmin,
}));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { masterPanelTeamRouter } from "./routers/masterPanel/team";

function platformAdminContext(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[]; active: boolean }): TrpcContext {
  return { platformAdmin: admin, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

const MEMBER_WITH_EQUIPE = platformAdminContext({ id: 2, email: "membro@plataforma.com", role: "member", permissions: ["equipe"], active: true });
// Owner sempre tem todas as áreas liberadas (mesmo raciocínio de
// withParsedPermissions em db/platformAdmins.ts — aqui o contexto é montado
// manualmente, então precisa refletir isso à mão).
const OWNER = platformAdminContext({ id: 1, email: "dono@plataforma.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS], active: true });

describe("team.create — escalação de privilégio pra owner", () => {
  it("member com área 'equipe' tentando criar conta owner é barrado com FORBIDDEN", async () => {
    mocks.createPlatformAdmin.mockClear();
    mocks.recordPlatformAuditLog.mockClear();

    const caller = masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE);
    await expect(
      caller.create({ name: "Invasor", email: "invasor@example.com", password: "senha1234", role: "owner", permissions: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // A escrita no banco e a auditoria nunca chegam a acontecer — a checagem
    // é antes de qualquer efeito colateral.
    expect(mocks.createPlatformAdmin).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("mesmo member com área 'equipe' pode criar outra conta member normalmente", async () => {
    mocks.createPlatformAdmin.mockClear();
    mocks.createPlatformAdmin.mockResolvedValue({ id: 9, name: "Novo Membro", email: "novo@example.com" });

    const caller = masterPanelTeamRouter.createCaller(MEMBER_WITH_EQUIPE);
    await expect(
      caller.create({ name: "Novo Membro", email: "novo@example.com", password: "senha1234", role: "member", permissions: ["planos"] }),
    ).resolves.toMatchObject({ id: 9 });

    expect(mocks.createPlatformAdmin).toHaveBeenCalledWith(expect.objectContaining({ role: "member" }));
  });

  it("uma conta owner PODE criar outra conta owner", async () => {
    mocks.createPlatformAdmin.mockClear();
    mocks.createPlatformAdmin.mockResolvedValue({ id: 10, name: "Novo Owner", email: "owner2@example.com" });

    const caller = masterPanelTeamRouter.createCaller(OWNER);
    await expect(
      caller.create({ name: "Novo Owner", email: "owner2@example.com", password: "senha1234", role: "owner", permissions: [] }),
    ).resolves.toMatchObject({ id: 10 });

    expect(mocks.createPlatformAdmin).toHaveBeenCalledWith(expect.objectContaining({ role: "owner" }));
  });
});
