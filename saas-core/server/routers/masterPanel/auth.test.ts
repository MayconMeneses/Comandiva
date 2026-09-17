import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../../_core/context";

/**
 * O 2FA (TOTP) do login do Painel Master foi removido a pedido do dono
 * (2026-09-17) — login volta a ser só e-mail+senha. Ver git log pra
 * histórico do que existiu antes (auth.ts guardou comentário apontando
 * pra onde ficou a infra de TOTP, ainda intacta mas sem uso).
 */
const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/platformAdmins", () => ({ authenticatePlatformAdmin: mocks.authenticatePlatformAdmin }));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("../../_core/env", () => ({
  ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", platformSessionCookieName: "platform_session" },
}));

import { masterPanelAuthRouter } from "./auth";

function makeCtx(opts: { ip: string }): TrpcContext & { res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } } {
  return {
    req: { ip: opts.ip, headers: {} } as unknown as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    restaurant: null,
    platformAdmin: null,
  } as never;
}

const ADMIN = { id: 42, name: "Dono", email: "dono@mmsystemcreator.com.br" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordPlatformAuditLog.mockResolvedValue(undefined);
});

describe("login — só e-mail e senha, sem 2FA", () => {
  it("senha certa: abre sessão direto, sem pedir código nenhum", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...ADMIN });
    const ctx = makeCtx({ ip: "203.0.113.1" });
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: ADMIN.email, password: "senha-certa" });

    expect(result).toEqual({ name: ADMIN.name, email: ADMIN.email });
    expect(ctx.res.cookie).toHaveBeenCalledWith("platform_session", expect.any(String), expect.anything());
    expect(ctx.res.cookie).not.toHaveBeenCalledWith("platform_trusted_device", expect.anything(), expect.anything());
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.login_success" }));
  });

  it("senha errada: rejeita com UNAUTHORIZED e registra a tentativa falha", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(undefined);
    const ctx = makeCtx({ ip: "203.0.113.2" });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "quem@quer.saber", password: "senha-errada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "E-mail ou senha inválidos.",
    });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.login_failed" }));
  });

  it("rate limit: 8 tentativas erradas seguidas do mesmo IP+e-mail bloqueiam a 9ª", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(undefined);
    const ip = "203.0.113.3";

    for (let i = 0; i < 8; i++) {
      const ctx = makeCtx({ ip });
      await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "quem@quer.saber", password: "senha-errada" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }

    const ctx = makeCtx({ ip });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "quem@quer.saber", password: "senha-errada" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("rate limit some depois de um login com sucesso (não fica acumulando pra sempre)", async () => {
    const ip = "203.0.113.4";
    mocks.authenticatePlatformAdmin.mockResolvedValue(undefined);
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: ADMIN.email, password: "errada" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...ADMIN });
    const result = await masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: ADMIN.email, password: "senha-certa" });
    expect(result).toEqual({ name: ADMIN.name, email: ADMIN.email });
  });
});

describe("logout", () => {
  it("limpa o cookie de sessão e registra auditoria quando há admin logado", async () => {
    const ctx = makeCtx({ ip: "203.0.113.5" });
    (ctx as unknown as { platformAdmin: typeof ADMIN }).platformAdmin = ADMIN;
    const result = await masterPanelAuthRouter.createCaller(ctx).logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("platform_session", expect.anything());
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.logout" }));
  });
});
