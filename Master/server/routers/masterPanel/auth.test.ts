import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "../../_core/context";

/**
 * Login do Painel Master, passo 1 (e-mail + senha) de contas SEM 2FA, mais os
 * limites, o audit log e os alertas. O fluxo completo COM 2FA (ativar,
 * pedir código, replay, código de recuperação, limite do 2º fator) está em
 * twoFactorFlow.test.ts.
 */
const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  markPlatformAdminSignedIn: vi.fn().mockResolvedValue(undefined),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
  sendTelegramMessageAsync: vi.fn(),
}));

vi.mock("../../db/platformAdmins", () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
  markPlatformAdminSignedIn: mocks.markPlatformAdminSignedIn,
}));
vi.mock("../../db/platformAdminSecurity", () => ({ getPlatformAdminSecurityRecord: vi.fn(), countUnusedRecoveryCodes: vi.fn() }));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("../../_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("../../_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: mocks.sendTelegramMessageAsync };
});
vi.mock("../../_core/env", () => ({
  ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", platformSessionCookieName: "platform_session", requirePlatform2fa: false },
}));

import { masterPanelAuthRouter } from "./auth";

function makeCtx(opts: { ip?: string; userAgent?: string; admin?: unknown }): TrpcContext & { res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } } {
  return {
    req: { ip: opts.ip, headers: { "user-agent": opts.userAgent ?? "Teste/1.0" }, socket: {} } as unknown as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    restaurant: null,
    platformAdmin: (opts.admin ?? null) as never,
  } as never;
}

const ADMIN = { id: 42, name: "Dono", email: "dono@mmsystemcreator.com.br", totpEnabled: false };
const OK = { ok: true as const, admin: { ...ADMIN } };
const FAIL_UNKNOWN = { ok: false as const, knownAdmin: null };
const FAIL_KNOWN = { ok: false as const, knownAdmin: { id: 42, email: ADMIN.email } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordPlatformAuditLog.mockResolvedValue(undefined);
  mocks.markPlatformAdminSignedIn.mockResolvedValue(undefined);
});

describe("login — conta sem 2FA", () => {
  it("senha certa: abre sessão direto, grava auditoria com IP e avisa no Telegram", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(OK);
    const ctx = makeCtx({ ip: "203.0.113.1" });
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: ADMIN.email, password: "senha-certa" });

    expect(result).toMatchObject({ requiresTotp: false, name: ADMIN.name, email: ADMIN.email });
    expect(ctx.res.cookie).toHaveBeenCalledWith("platform_session", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.login_success", ip: "203.0.113.1" }));
    expect(mocks.sendTelegramMessageAsync).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessageAsync.mock.calls[0]![0]).toContain("Login no Painel Master");
  });

  it("IP sempre preenchido no audit, mesmo quando o Express não informa req.ip", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    const ctx = makeCtx({ ip: undefined });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "sem-ip@exemplo.com", password: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ ip: "desconhecido" }));
  });

  it("e-mail inexistente: mesma mensagem, audit com actorLabel genérico (nunca o e-mail digitado)", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    const ctx = makeCtx({ ip: "203.0.113.2" });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "quem@quer.saber", password: "senha-errada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "E-mail ou senha inválidos.",
    });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.login_failed", actorLabel: "desconhecido", actorAdminId: null }));
    expect(JSON.stringify(mocks.recordPlatformAuditLog.mock.calls)).not.toContain("quem@quer.saber");
  });

  it("senha errada de conta existente: mesma mensagem, audit identifica a conta", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_KNOWN);
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.3" })).login({ email: ADMIN.email, password: "errada" })).rejects.toMatchObject({
      message: "E-mail ou senha inválidos.",
    });
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.login_failed", actorLabel: ADMIN.email, actorAdminId: 42 }));
  });

  it("login_failed: só 1 linha de auditoria por IP+e-mail na janela (tabela append-only não enche)", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    for (let i = 0; i < 4; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.4" })).login({ email: "repete@exemplo.com", password: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    expect(mocks.recordPlatformAuditLog.mock.calls.filter(([entry]) => entry.action === "admin.login_failed")).toHaveLength(1);
  });

  it("limite: 5 falhas seguidas do mesmo IP+e-mail bloqueiam a 6ª", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    const ip = "203.0.113.5";
    for (let i = 0; i < 5; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: "alvo@exemplo.com", password: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: "alvo@exemplo.com", password: "x" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("limite por IP: variar o e-mail a cada tentativa não escapa — 15 falhas/hora por IP", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    const ip = "203.0.113.6";
    for (let i = 0; i < 15; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: `alvo${i}@exemplo.com`, password: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: "alvo-novo@exemplo.com", password: "x" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("outro IP errando o e-mail do dono NÃO tranca o dono: o limite é por IP, não por e-mail", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_KNOWN);
    for (let i = 0; i < 5; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "198.51.100.7" })).login({ email: ADMIN.email, password: "chute" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "198.51.100.7" })).login({ email: ADMIN.email, password: "chute" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    mocks.authenticatePlatformAdmin.mockResolvedValue(OK);
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.77" })).login({ email: ADMIN.email, password: "senha-certa" })).resolves.toMatchObject({ requiresTotp: false });
  });

  it("login com sucesso zera o contador IP+e-mail e não gasta o limite por IP", async () => {
    const ip = "203.0.113.8";
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_KNOWN);
    for (let i = 0; i < 4; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: ADMIN.email, password: "errada" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    mocks.authenticatePlatformAdmin.mockResolvedValue(OK);
    await masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: ADMIN.email, password: "certa" });
    // contador zerado: dá pra errar mais 5 vezes antes de bloquear
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_KNOWN);
    for (let i = 0; i < 5; i++) {
      await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email: ADMIN.email, password: "errada" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  });

  it("10 falhas na hora pro mesmo e-mail disparam alerta no Telegram, sem bloquear o login", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(FAIL_UNKNOWN);
    const email = "alvo-alerta@exemplo.com";
    for (const ip of ["203.0.113.21", "203.0.113.22"]) {
      for (let i = 0; i < 5; i++) {
        await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip })).login({ email, password: "x" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }
    }
    const alerts = mocks.sendTelegramMessageAsync.mock.calls.map(([text]) => String(text)).filter(text => text.includes("Falhas repetidas"));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain(email);
  });

  it("conta com 2FA: senha certa NÃO abre sessão, devolve só o token pendente", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ok: true, admin: { ...ADMIN, totpEnabled: true } });
    const ctx = makeCtx({ ip: "203.0.113.9" });
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: ADMIN.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresTotp: true, pendingToken: expect.any(String) });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessageAsync).not.toHaveBeenCalled();
  });
});

describe("me", () => {
  it("não expõe segredos nem o marco interno de sessão, e informa mustSetupTotp", async () => {
    const admin = { id: 1, email: "a@b.com", name: "A", role: "owner", permissions: [], active: true, totpEnabled: false, sessionsValidAfter: 123, lastSignedInAt: null };
    const me = await masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.10", admin })).me();
    expect(me).toMatchObject({ id: 1, totpEnabled: false, mustSetupTotp: false });
    expect(me).not.toHaveProperty("sessionsValidAfter");
    expect(me).not.toHaveProperty("passwordHash");
    expect(me).not.toHaveProperty("totpSecret");
    expect(me).not.toHaveProperty("totpLastStep");
  });

  it("sem sessão devolve null", async () => {
    await expect(masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.11" })).me()).resolves.toBeNull();
  });
});

describe("logout", () => {
  it("limpa o cookie de sessão e registra auditoria quando há admin logado", async () => {
    const ctx = makeCtx({ ip: "203.0.113.12", admin: ADMIN });
    const result = await masterPanelAuthRouter.createCaller(ctx).logout();
    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("platform_session", expect.anything());
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "admin.logout" }));
  });
});
