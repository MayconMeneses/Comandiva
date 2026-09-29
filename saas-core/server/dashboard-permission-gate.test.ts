import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

/**
 * Achado M4 da auditoria: masterPanel.dashboard.summary usava
 * platformAdminProcedure puro (só exigia sessão válida), diferente de
 * billing/planos/auditoria (todos gateados por área) — um "member" criado
 * sem nenhuma área concedida ainda via MRR, distribuição de planos e
 * tendência de cadastros da plataforma inteira. Gate corrigido pra
 * platformAdminProcedureFor("billing").
 */
const mocks = vi.hoisted(() => ({ getDashboardSummary: vi.fn().mockResolvedValue({ mrrCents: 0 }) }));
vi.mock("./db/dashboard", () => ({ getDashboardSummary: mocks.getDashboardSummary }));

import { masterPanelDashboardRouter } from "./routers/masterPanel/dashboard";

function platformAdminContext(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[]; active: boolean }): TrpcContext {
  return { platformAdmin: admin, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

describe("masterPanel.dashboard.summary — gate por área", () => {
  it("member sem nenhuma área concedida é barrado com FORBIDDEN", async () => {
    mocks.getDashboardSummary.mockClear();
    const caller = masterPanelDashboardRouter.createCaller(platformAdminContext({ id: 2, email: "membro@plataforma.com", role: "member", permissions: [], active: true }));
    await expect(caller.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDashboardSummary).not.toHaveBeenCalled();
  });

  it("member com a área 'billing' concedida consegue ver o resumo", async () => {
    mocks.getDashboardSummary.mockClear();
    const caller = masterPanelDashboardRouter.createCaller(platformAdminContext({ id: 2, email: "membro@plataforma.com", role: "member", permissions: ["billing"], active: true }));
    await expect(caller.summary()).resolves.toBeDefined();
    expect(mocks.getDashboardSummary).toHaveBeenCalled();
  });

  it("owner sempre consegue ver, mesmo sem áreas explícitas salvas (owner tem todas por padrão)", async () => {
    mocks.getDashboardSummary.mockClear();
    const caller = masterPanelDashboardRouter.createCaller(platformAdminContext({ id: 1, email: "dono@plataforma.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS], active: true }));
    await expect(caller.summary()).resolves.toBeDefined();
  });
});
