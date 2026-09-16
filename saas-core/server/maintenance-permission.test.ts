import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

/**
 * Prova o controle de acesso da área "manutencao" (assistente de IA
 * só-leitura): member sem a área é barrado ANTES de gastar uma chamada à API
 * de IA (mesmo padrão de team-privilege-escalation.test.ts — checagem antes
 * de qualquer efeito colateral), member com a área passa, owner sempre passa.
 */
const mocks = vi.hoisted(() => ({
  askMaintenanceAssistant: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/maintenanceAssistant", () => ({ askMaintenanceAssistant: mocks.askMaintenanceAssistant }));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { masterPanelMaintenanceRouter } from "./routers/masterPanel/maintenance";

function platformAdminContext(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[]; active: boolean }): TrpcContext {
  return { platformAdmin: admin, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

const MEMBER_WITHOUT_MANUTENCAO = platformAdminContext({ id: 101, email: "membro1@plataforma.com", role: "member", permissions: ["restaurantes"], active: true });
const MEMBER_WITH_MANUTENCAO = platformAdminContext({ id: 102, email: "membro2@plataforma.com", role: "member", permissions: ["manutencao"], active: true });
const OWNER = platformAdminContext({ id: 100, email: "dono@plataforma.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS], active: true });

describe("masterPanelMaintenanceRouter.ask — controle de acesso", () => {
  it("member sem a área 'manutencao' é barrado com FORBIDDEN, sem chamar o assistente", async () => {
    mocks.askMaintenanceAssistant.mockClear();
    const caller = masterPanelMaintenanceRouter.createCaller(MEMBER_WITHOUT_MANUTENCAO);
    await expect(caller.ask({ question: "quantos restaurantes existem?" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.askMaintenanceAssistant).not.toHaveBeenCalled();
  });

  it("member com a área 'manutencao' consegue perguntar", async () => {
    mocks.askMaintenanceAssistant.mockClear();
    mocks.askMaintenanceAssistant.mockResolvedValue({ answer: "resposta de teste" });
    const caller = masterPanelMaintenanceRouter.createCaller(MEMBER_WITH_MANUTENCAO);
    await expect(caller.ask({ question: "quantos restaurantes existem?" })).resolves.toEqual({ answer: "resposta de teste" });
  });

  it("owner sempre passa", async () => {
    mocks.askMaintenanceAssistant.mockClear();
    mocks.askMaintenanceAssistant.mockResolvedValue({ answer: "ok" });
    const caller = masterPanelMaintenanceRouter.createCaller(OWNER);
    await expect(caller.ask({ question: "tudo bem por aqui?" })).resolves.toEqual({ answer: "ok" });
  });

  it("rejeita pergunta muito curta (validação de input)", async () => {
    const caller = masterPanelMaintenanceRouter.createCaller(MEMBER_WITH_MANUTENCAO);
    await expect(caller.ask({ question: "a" })).rejects.toBeTruthy();
  });
});
