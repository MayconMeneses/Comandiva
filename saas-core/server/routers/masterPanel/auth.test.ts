import { describe, expect, it, vi, beforeEach } from "vitest";
import * as OTPAuth from "otpauth";
import type { TrpcContext } from "../../_core/context";

/**
 * Cobre o fluxo de 2FA (TOTP) do login do Painel Master, pedido explícito
 * do dono depois de confirmar que queria a camada extra de segurança —
 * com a ressalva de não travar manutenções no mesmo dispositivo (por isso
 * o "dispositivo confiável": ver server/_core/platformSession.ts). A parte
 * mais crítica: o rate limit só pode ser limpo quando TODO o fluxo (senha +
 * código) termina com sucesso — limpar logo depois da senha deixaria o
 * código de 6 dígitos sem limite de tentativas (mesmo bug já corrigido
 * antes no app principal desta plataforma).
 */
const mocks = vi.hoisted(() => ({
  authenticatePlatformAdmin: vi.fn(),
  enablePlatformAdminTotp: vi.fn().mockResolvedValue(undefined),
  getPlatformAdminById: vi.fn(),
  getPlatformAdminTotpSecretById: vi.fn(),
  setPlatformAdminTotpSecret: vi.fn().mockResolvedValue(undefined),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../db/platformAdmins", () => ({
  authenticatePlatformAdmin: mocks.authenticatePlatformAdmin,
  enablePlatformAdminTotp: mocks.enablePlatformAdminTotp,
  getPlatformAdminById: mocks.getPlatformAdminById,
  getPlatformAdminTotpSecretById: mocks.getPlatformAdminTotpSecretById,
  setPlatformAdminTotpSecret: mocks.setPlatformAdminTotpSecret,
}));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("../../_core/env", () => ({
  ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", platformSessionCookieName: "platform_session" },
}));

import { masterPanelAuthRouter } from "./auth";

function currentCodeFor(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({ issuer: "MM System Creator", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  return totp.generate();
}

function makeCtx(opts: { ip: string; cookie?: string }): TrpcContext & { res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } } {
  return {
    req: { ip: opts.ip, headers: { cookie: opts.cookie ?? "" } } as unknown as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    restaurant: null,
    platformAdmin: null,
  } as never;
}

const ADMIN = { id: 42, name: "Dono", email: "dono@mmsystemcreator.com.br", totpEnabled: false, totpSecret: null as string | null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enablePlatformAdminTotp.mockResolvedValue(undefined);
  mocks.setPlatformAdminTotpSecret.mockResolvedValue(undefined);
  mocks.recordPlatformAuditLog.mockResolvedValue(undefined);
});

describe("login — 2FA ainda não configurado", () => {
  it("senha certa + totpEnabled=false: devolve QR code de setup, não abre sessão ainda", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...ADMIN });
    const ctx = makeCtx({ ip: "203.0.113.1" });
    const caller = masterPanelAuthRouter.createCaller(ctx);

    const result = await caller.login({ email: ADMIN.email, password: "senha-certa" });

    expect(result).toMatchObject({ requiresTotpSetup: true });
    expect(mocks.setPlatformAdminTotpSecret).toHaveBeenCalledWith(ADMIN.id, expect.any(String));
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });
});

describe("confirmTotpSetup", () => {
  it("código certo: habilita 2FA, abre sessão e marca o dispositivo como confiável", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...ADMIN });
    const setupCtx = makeCtx({ ip: "203.0.113.2" });
    const setupCaller = masterPanelAuthRouter.createCaller(setupCtx);
    const setup = await setupCaller.login({ email: ADMIN.email, password: "senha-certa" });
    if (!("requiresTotpSetup" in setup)) throw new Error("esperava requiresTotpSetup");

    const savedSecret = mocks.setPlatformAdminTotpSecret.mock.calls[0][1] as string;
    mocks.getPlatformAdminById.mockResolvedValue({ ...ADMIN });
    mocks.getPlatformAdminTotpSecretById.mockResolvedValue(savedSecret);

    const confirmCtx = makeCtx({ ip: "203.0.113.2" });
    const confirmCaller = masterPanelAuthRouter.createCaller(confirmCtx);
    const code = currentCodeFor(savedSecret, ADMIN.email);
    const result = await confirmCaller.confirmTotpSetup({ pendingToken: setup.pendingToken, code });

    expect(result).toEqual({ name: ADMIN.name, email: ADMIN.email });
    expect(mocks.enablePlatformAdminTotp).toHaveBeenCalledWith(ADMIN.id);
    expect(confirmCtx.res.cookie).toHaveBeenCalledWith("platform_session", expect.any(String), expect.anything());
    expect(confirmCtx.res.cookie).toHaveBeenCalledWith("platform_trusted_device", expect.any(String), expect.anything());
  });

  it("código errado: rejeita e não habilita 2FA", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...ADMIN });
    const setupCtx = makeCtx({ ip: "203.0.113.3" });
    const setup = await masterPanelAuthRouter.createCaller(setupCtx).login({ email: ADMIN.email, password: "senha-certa" });
    if (!("requiresTotpSetup" in setup)) throw new Error("esperava requiresTotpSetup");

    mocks.getPlatformAdminById.mockResolvedValue({ ...ADMIN });
    mocks.getPlatformAdminTotpSecretById.mockResolvedValue(mocks.setPlatformAdminTotpSecret.mock.calls[0][1]);

    const confirmCaller = masterPanelAuthRouter.createCaller(makeCtx({ ip: "203.0.113.3" }));
    await expect(confirmCaller.confirmTotpSetup({ pendingToken: setup.pendingToken, code: "000000" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.enablePlatformAdminTotp).not.toHaveBeenCalled();
  });
});

describe("login — 2FA já habilitado, dispositivo novo (sem cookie de confiança)", () => {
  const enabledAdmin = { ...ADMIN, totpEnabled: true, totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };

  it("senha certa, sem totpToken: pede o código, não abre sessão", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    const ctx = makeCtx({ ip: "203.0.113.4" });
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresTotpToken: true });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("senha certa + código certo: abre sessão e marca dispositivo confiável", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    const ctx = makeCtx({ ip: "203.0.113.5" });
    const code = currentCodeFor(enabledAdmin.totpSecret, enabledAdmin.email);
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: code });
    expect(result).toEqual({ name: enabledAdmin.name, email: enabledAdmin.email });
    expect(ctx.res.cookie).toHaveBeenCalledWith("platform_trusted_device", expect.any(String), expect.anything());
  });

  it("senha certa + código errado: rejeita com UNAUTHORIZED", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    const ctx = makeCtx({ ip: "203.0.113.6" });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: "000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("REGRESSÃO: código errado repetido com senha sempre certa é limitado (rate limit só limpa no sucesso completo, não logo após a senha)", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    const ip = "203.0.113.7";

    for (let i = 0; i < 8; i++) {
      const ctx = makeCtx({ ip });
      await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: "000000" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }

    const ctx = makeCtx({ ip });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: "000000" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });
});

describe("login — dispositivo confiável dispensa o código", () => {
  const enabledAdmin = { ...ADMIN, totpEnabled: true, totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };

  it("cookie de dispositivo confiável válido pra esta conta: entra só com a senha, sem pedir código", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    // Primeiro login de verdade gera o cookie de confiança.
    const firstCtx = makeCtx({ ip: "203.0.113.8" });
    const code = currentCodeFor(enabledAdmin.totpSecret, enabledAdmin.email);
    await masterPanelAuthRouter.createCaller(firstCtx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: code });
    const trustedDeviceCall = firstCtx.res.cookie.mock.calls.find(call => call[0] === "platform_trusted_device");
    const trustedDeviceToken = trustedDeviceCall?.[1] as string;

    // Segundo login, "navegador" mandando o cookie de volta — sem totpToken.
    const secondCtx = makeCtx({ ip: "203.0.113.8", cookie: `platform_trusted_device=${trustedDeviceToken}` });
    const result = await masterPanelAuthRouter.createCaller(secondCtx).login({ email: enabledAdmin.email, password: "senha-certa" });
    expect(result).toEqual({ name: enabledAdmin.name, email: enabledAdmin.email });
  });

  it("cookie de dispositivo confiável de OUTRA conta não serve pra esta", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin });
    const otherAdminCtx = makeCtx({ ip: "203.0.113.9" });
    const code = currentCodeFor(enabledAdmin.totpSecret, enabledAdmin.email);
    // Gera um cookie válido pra um admin de id diferente (999).
    mocks.authenticatePlatformAdmin.mockResolvedValueOnce({ ...enabledAdmin, id: 999 });
    await masterPanelAuthRouter.createCaller(otherAdminCtx).login({ email: enabledAdmin.email, password: "senha-certa", totpToken: code });
    const trustedDeviceToken = otherAdminCtx.res.cookie.mock.calls.find(call => call[0] === "platform_trusted_device")?.[1] as string;

    mocks.authenticatePlatformAdmin.mockResolvedValue({ ...enabledAdmin, id: 42 });
    const ctx = makeCtx({ ip: "203.0.113.9", cookie: `platform_trusted_device=${trustedDeviceToken}` });
    const result = await masterPanelAuthRouter.createCaller(ctx).login({ email: enabledAdmin.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresTotpToken: true });
  });
});

describe("login — senha errada nunca revela se 2FA está habilitado", () => {
  it("senha errada: sempre 'E-mail ou senha inválidos', mesmo com totpToken presente", async () => {
    mocks.authenticatePlatformAdmin.mockResolvedValue(undefined);
    const ctx = makeCtx({ ip: "203.0.113.10" });
    await expect(masterPanelAuthRouter.createCaller(ctx).login({ email: "quem@quer.saber", password: "senha-errada", totpToken: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "E-mail ou senha inválidos.",
    });
  });
});
