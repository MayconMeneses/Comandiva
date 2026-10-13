import * as OTPAuth from "otpauth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";

/**
 * Fluxo completo do 2FA do Painel Master, com criptografia, TOTP e geração de
 * códigos de recuperação REAIS — só o banco é trocado por uma versão em
 * memória (state) e o relógio (Date) é controlado pra testar o anti-replay.
 */
type FakeAdmin = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  passwordHash: string;
  totpEnabled: boolean;
  totpSecret: string | null;
  totpLastStep: number | null;
  sessionsValidAfter: number | null;
};

const state = vi.hoisted(() => ({
  admin: null as unknown as FakeAdmin,
  codes: [] as { hash: string; usedAt: number | null }[],
  telegram: [] as string[],
  audit: [] as { action: string }[],
}));

vi.mock("../../_core/env", () => ({
  ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", platformSessionCookieName: "platform_session", requirePlatform2fa: false },
}));
vi.mock("../../_core/platformPassword", () => ({
  // Senha "senha-certa" é a única válida — sem scrypt de verdade nos testes de fluxo.
  verifyPlatformPassword: async (password: string) => password === "senha-certa",
}));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: async (entry: { action: string }) => { state.audit.push(entry); } }));
vi.mock("../../_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("../../_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: (text: string) => { state.telegram.push(text); } };
});
vi.mock("../../db/platformAdmins", () => ({
  authenticatePlatformAdmin: async (email: string, password: string) =>
    email === state.admin.email && password === "senha-certa"
      ? { ok: true, admin: { id: state.admin.id, name: state.admin.name, email: state.admin.email, totpEnabled: state.admin.totpEnabled } }
      : { ok: false, knownAdmin: null },
  markPlatformAdminSignedIn: async () => undefined,
}));
vi.mock("../../db/platformAdminSecurity", () => ({
  getPlatformAdminSecurityRecord: async (id: number) => (state.admin.id === id ? { ...state.admin } : undefined),
  storePendingTotpSecret: async (_id: number, encrypted: string) => {
    if (state.admin.totpEnabled) return false;
    state.admin.totpSecret = encrypted;
    state.admin.totpLastStep = null;
    return true;
  },
  claimTotpStep: async (_id: number, step: number) => {
    if (state.admin.totpLastStep !== null && state.admin.totpLastStep >= step) return false;
    state.admin.totpLastStep = step;
    return true;
  },
  enablePlatformAdminTotp: async (_id: number, step: number, hashes: string[]) => {
    if (state.admin.totpEnabled) return false;
    Object.assign(state.admin, { totpEnabled: true, totpLastStep: step, sessionsValidAfter: Math.floor(Date.now() / 1000) });
    state.codes = hashes.map(hash => ({ hash, usedAt: null }));
    return true;
  },
  disablePlatformAdminTotp: async () => {
    Object.assign(state.admin, { totpEnabled: false, totpSecret: null, totpLastStep: null, sessionsValidAfter: Math.floor(Date.now() / 1000) });
    state.codes = [];
  },
  replacePlatformAdminRecoveryCodes: async (_id: number, hashes: string[]) => { state.codes = hashes.map(hash => ({ hash, usedAt: null })); },
  consumeRecoveryCode: async (_id: number, hash: string) => {
    const row = state.codes.find(code => code.hash === hash && code.usedAt === null);
    if (!row) return false;
    row.usedAt = Date.now();
    return true;
  },
  countUnusedRecoveryCodes: async () => state.codes.filter(code => code.usedAt === null).length,
  revokeAllPlatformAdminSessions: async () => { state.admin.sessionsValidAfter = Math.floor(Date.now() / 1000); },
}));

import { masterPanelAuthRouter } from "./auth";
import { masterPanelSecurityRouter } from "./security";
import { decryptTotpSecret } from "../../_core/totpCrypto";
import { verifyPlatformSessionToken } from "../../_core/platformSession";

let nextAdminId = 1000;
let nextIp = 1;

function freshAdmin(): FakeAdmin {
  // id novo por teste: os contadores de rate limit são globais do processo e usam o id como chave.
  const id = nextAdminId++;
  return { id, name: "Dono", email: `dono${id}@exemplo.com`, active: true, passwordHash: "x", totpEnabled: false, totpSecret: null, totpLastStep: null, sessionsValidAfter: null };
}

function makeCtx(ip: string, withAdmin = false) {
  return {
    req: { ip, headers: { "user-agent": "Teste" }, socket: {} } as unknown as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    restaurant: null,
    platformAdmin: withAdmin ? ({ id: state.admin.id, email: state.admin.email, active: true, role: "owner", permissions: [], totpEnabled: state.admin.totpEnabled } as never) : null,
  } as TrpcContext & { res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } };
}

const auth = (ctx: TrpcContext) => masterPanelAuthRouter.createCaller(ctx);
const security = (ctx: TrpcContext) => masterPanelSecurityRouter.createCaller(ctx);

/** Código que o app autenticador mostraria agora (usa o segredo em texto puro, que só o teste conhece). */
function authenticatorCode(manualKey: string, atMs = Date.now()): string {
  return new OTPAuth.TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(manualKey) }).generate({ timestamp: atMs });
}

/** Ativa o 2FA de ponta a ponta e devolve a chave e os códigos de recuperação. */
async function enableTotp() {
  const ip = `198.51.100.${nextIp++}`;
  const started = await security(makeCtx(ip, true)).startTotpSetup({ password: "senha-certa" });
  const confirmed = await security(makeCtx(ip, true)).confirmTotpSetup({ code: authenticatorCode(started.manualKey) });
  return { manualKey: started.manualKey, recoveryCodes: confirmed.recoveryCodes };
}

beforeEach(() => {
  state.admin = freshAdmin();
  state.codes = [];
  state.telegram = [];
  state.audit = [];
  // Só o Date é falso (jose, otpauth e o servidor leem a mesma hora); timers reais seguem normais.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ativar o 2FA", () => {
  it("exige a senha atual pra começar (cookie roubado sozinho não liga um 2FA do atacante)", async () => {
    await expect(security(makeCtx("192.0.2.1", true)).startTotpSetup({ password: "senha-errada" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.admin.totpSecret).toBeNull();
  });

  it("guarda o segredo CRIPTOGRAFADO (nunca em texto puro) e só liga depois do primeiro código", async () => {
    const started = await security(makeCtx("192.0.2.2", true)).startTotpSetup({ password: "senha-certa" });
    expect(started.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(state.admin.totpSecret).toMatch(/^v1:/);
    expect(state.admin.totpSecret).not.toContain(started.manualKey);
    expect(decryptTotpSecret(state.admin.totpSecret!)).toBe(started.manualKey);
    expect(state.admin.totpEnabled).toBe(false);
    expect(state.audit.map(entry => entry.action)).toContain("admin.totp_setup_started");
  });

  it("código errado na confirmação não liga o 2FA; o certo liga, devolve 10 códigos e emite sessão nova", async () => {
    const ip = "192.0.2.3";
    const started = await security(makeCtx(ip, true)).startTotpSetup({ password: "senha-certa" });
    await expect(security(makeCtx(ip, true)).confirmTotpSetup({ code: "000000" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.admin.totpEnabled).toBe(false);

    const ctx = makeCtx(ip, true);
    const confirmed = await security(ctx).confirmTotpSetup({ code: authenticatorCode(started.manualKey) });
    expect(confirmed.recoveryCodes).toHaveLength(10);
    for (const code of confirmed.recoveryCodes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(new Set(confirmed.recoveryCodes).size).toBe(10);
    expect(state.admin.totpEnabled).toBe(true);
    // Só o hash vai pro banco.
    for (const row of state.codes) expect(confirmed.recoveryCodes).not.toContain(row.hash);
    // Sessão nova, válida mesmo com sessionsValidAfter gravado no mesmo segundo.
    const cookieToken = ctx.res.cookie.mock.calls[0]![1] as string;
    const session = await verifyPlatformSessionToken(cookieToken);
    expect(session?.iat).toBeGreaterThanOrEqual(state.admin.sessionsValidAfter!);
    expect(state.audit.map(entry => entry.action)).toContain("admin.totp_enabled");
  });

  it("status e respostas do fluxo nunca contêm o segredo, hashes nem passo interno", async () => {
    const { manualKey } = await enableTotp();
    const status = await security(makeCtx("192.0.2.4", true)).status();
    expect(status).toEqual({ totpEnabled: true, setupPending: false, recoveryCodesRemaining: 10, totpRequired: false });
    const loginResult = await auth(makeCtx("192.0.2.5")).login({ email: state.admin.email, password: "senha-certa" });
    for (const response of [status, loginResult]) {
      const json = JSON.stringify(response);
      expect(json).not.toContain(manualKey);
      expect(json).not.toContain(state.admin.totpSecret!);
      expect(json).not.toContain("passwordHash");
      expect(json).not.toContain("totpLastStep");
    }
  });
});

describe("login com 2FA ativo", () => {
  it("senha certa não dá sessão; o token pendente NÃO vale como cookie de sessão", async () => {
    await enableTotp();
    const ctx = makeCtx("192.0.2.10");
    const result = await auth(ctx).login({ email: state.admin.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresTotp: true });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
    if (!result.requiresTotp) throw new Error("esperava requiresTotp");
    await expect(verifyPlatformSessionToken(result.pendingToken)).resolves.toBeNull();
  });

  it("código errado recusa; código certo abre sessão e alerta no Telegram (com 2FA)", async () => {
    const { manualKey } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z")); // passo novo (o do ativar já foi gasto)
    const ip = "192.0.2.11";
    const pending = await auth(makeCtx(ip)).login({ email: state.admin.email, password: "senha-certa" });
    if (!pending.requiresTotp) throw new Error("esperava requiresTotp");

    await expect(auth(makeCtx(ip)).verifyTotp({ pendingToken: pending.pendingToken, code: "123456" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.audit.map(entry => entry.action)).toContain("admin.totp_failed");

    const ctx = makeCtx(ip);
    const result = await auth(ctx).verifyTotp({ pendingToken: pending.pendingToken, code: authenticatorCode(manualKey) });
    expect(result).toMatchObject({ requiresTotp: false, usedRecoveryCode: false });
    expect(ctx.res.cookie).toHaveBeenCalledTimes(1);
    expect(state.telegram.some(text => text.includes("Login no Painel Master") && text.includes("sim"))).toBe(true);
  });

  it("anti-replay: o mesmo código (mesmo ainda na janela) não entra duas vezes", async () => {
    const { manualKey } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    const code = authenticatorCode(manualKey);

    const first = await auth(makeCtx("192.0.2.12")).login({ email: state.admin.email, password: "senha-certa" });
    if (!first.requiresTotp) throw new Error("esperava requiresTotp");
    await auth(makeCtx("192.0.2.12")).verifyTotp({ pendingToken: first.pendingToken, code });

    const second = await auth(makeCtx("192.0.2.13")).login({ email: state.admin.email, password: "senha-certa" });
    if (!second.requiresTotp) throw new Error("esperava requiresTotp");
    await expect(auth(makeCtx("192.0.2.13")).verifyTotp({ pendingToken: second.pendingToken, code })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    // Um passo depois, o código novo funciona.
    vi.setSystemTime(new Date("2026-10-10T12:01:31Z"));
    await expect(auth(makeCtx("192.0.2.13")).verifyTotp({ pendingToken: second.pendingToken, code: authenticatorCode(manualKey) })).resolves.toMatchObject({ requiresTotp: false });
  });

  it("código de recuperação funciona UMA vez só, aceita minúsculas/sem hífen, e alerta forte no Telegram", async () => {
    const { recoveryCodes } = await enableTotp();
    const [code] = recoveryCodes;
    const pending = await auth(makeCtx("192.0.2.14")).login({ email: state.admin.email, password: "senha-certa" });
    if (!pending.requiresTotp) throw new Error("esperava requiresTotp");

    const result = await auth(makeCtx("192.0.2.14")).verifyTotp({ pendingToken: pending.pendingToken, code: code!.toLowerCase().replace("-", " ") });
    expect(result).toMatchObject({ usedRecoveryCode: true, recoveryCodesRemaining: null });
    expect(state.audit.map(entry => entry.action)).toContain("admin.recovery_code_used");
    expect(state.telegram.some(text => text.includes("CÓDIGO DE RECUPERAÇÃO"))).toBe(true);

    await expect(auth(makeCtx("192.0.2.14")).verifyTotp({ pendingToken: pending.pendingToken, code: code! })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("avisa quando restam 2 ou menos códigos de recuperação", async () => {
    const { recoveryCodes } = await enableTotp();
    let last: Awaited<ReturnType<ReturnType<typeof auth>["verifyTotp"]>> | undefined;
    for (const code of recoveryCodes.slice(0, 8)) {
      const pending = await auth(makeCtx("192.0.2.15")).login({ email: state.admin.email, password: "senha-certa" });
      if (!pending.requiresTotp) throw new Error("esperava requiresTotp");
      last = await auth(makeCtx("192.0.2.15")).verifyTotp({ pendingToken: pending.pendingToken, code });
    }
    expect(last).toMatchObject({ usedRecoveryCode: true, recoveryCodesRemaining: 2 });
  });

  it("limite rígido: 5 códigos errados trancam a conta por 10min mesmo com o código certo (e vale por conta, não só por IP)", async () => {
    const { manualKey } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    const pending = await auth(makeCtx("192.0.2.16")).login({ email: state.admin.email, password: "senha-certa" });
    if (!pending.requiresTotp) throw new Error("esperava requiresTotp");

    // IPs diferentes a cada chute: o limite por CONTA pega do mesmo jeito.
    for (let i = 0; i < 5; i++) {
      await expect(auth(makeCtx(`203.0.113.${100 + i}`)).verifyTotp({ pendingToken: pending.pendingToken, code: "000000" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(auth(makeCtx("192.0.2.17")).verifyTotp({ pendingToken: pending.pendingToken, code: authenticatorCode(manualKey) })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // Depois da janela, o código certo volta a funcionar.
    vi.setSystemTime(new Date("2026-10-10T12:12:00Z"));
    const fresh = await auth(makeCtx("192.0.2.18")).login({ email: state.admin.email, password: "senha-certa" });
    if (!fresh.requiresTotp) throw new Error("esperava requiresTotp");
    await expect(auth(makeCtx("192.0.2.18")).verifyTotp({ pendingToken: fresh.pendingToken, code: authenticatorCode(manualKey) })).resolves.toMatchObject({ requiresTotp: false });
  });

  it("token pendente de antes de uma troca de senha/2FA deixa de valer", async () => {
    const { manualKey } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    const pending = await auth(makeCtx("192.0.2.19")).login({ email: state.admin.email, password: "senha-certa" });
    if (!pending.requiresTotp) throw new Error("esperava requiresTotp");
    vi.setSystemTime(new Date("2026-10-10T12:01:10Z"));
    state.admin.sessionsValidAfter = Math.floor(Date.now() / 1000); // ex.: senha trocada nesse meio tempo
    await expect(auth(makeCtx("192.0.2.19")).verifyTotp({ pendingToken: pending.pendingToken, code: authenticatorCode(manualKey) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("token pendente inválido/adulterado é recusado", async () => {
    await expect(auth(makeCtx("192.0.2.20")).verifyTotp({ pendingToken: "isto.nao.e-um-jwt", code: "123456" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("desativar e regenerar", () => {
  it("desativar exige senha E código; com senha errada nada muda; com tudo certo zera segredo e códigos", async () => {
    const { manualKey, recoveryCodes } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    const ip = "192.0.2.30";

    await expect(security(makeCtx(ip, true)).disableTotp({ password: "senha-errada", code: authenticatorCode(manualKey) })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(security(makeCtx(ip, true)).disableTotp({ password: "senha-certa", code: "000000" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.admin.totpEnabled).toBe(true);

    // Funciona também com um código de recuperação no lugar do código do app.
    await security(makeCtx(ip, true)).disableTotp({ password: "senha-certa", code: recoveryCodes[0]! });
    expect(state.admin.totpEnabled).toBe(false);
    expect(state.admin.totpSecret).toBeNull();
    expect(state.codes).toHaveLength(0);
    expect(state.audit.map(entry => entry.action)).toContain("admin.totp_disabled");
  });

  it("regenerar troca a lista: os códigos antigos deixam de funcionar", async () => {
    const { manualKey, recoveryCodes } = await enableTotp();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    const regenerated = await security(makeCtx("192.0.2.31", true)).regenerateRecoveryCodes({ password: "senha-certa", code: authenticatorCode(manualKey) });
    expect(regenerated.recoveryCodes).toHaveLength(10);
    expect(regenerated.recoveryCodes.some(code => recoveryCodes.includes(code))).toBe(false);
    expect(state.audit.map(entry => entry.action)).toContain("admin.recovery_codes_regenerated");

    const pending = await auth(makeCtx("192.0.2.32")).login({ email: state.admin.email, password: "senha-certa" });
    if (!pending.requiresTotp) throw new Error("esperava requiresTotp");
    await expect(auth(makeCtx("192.0.2.32")).verifyTotp({ pendingToken: pending.pendingToken, code: recoveryCodes[0]! })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(auth(makeCtx("192.0.2.32")).verifyTotp({ pendingToken: pending.pendingToken, code: regenerated.recoveryCodes[0]! })).resolves.toMatchObject({ usedRecoveryCode: true });
  });

  it("'sair de todos os dispositivos' grava o marco de revogação, limpa o cookie e audita", async () => {
    const ctx = makeCtx("192.0.2.33", true);
    await security(ctx).revokeAllSessions();
    expect(state.admin.sessionsValidAfter).toBe(Math.floor(Date.now() / 1000));
    expect(ctx.res.clearCookie).toHaveBeenCalledWith("platform_session", expect.anything());
    expect(state.audit.map(entry => entry.action)).toContain("admin.sessions_revoked");
  });
});
