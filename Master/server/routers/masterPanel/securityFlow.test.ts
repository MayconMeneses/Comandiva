import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../../_core/context";

/**
 * Fluxo completo da verificação do Painel Master (pergunta de segurança + código de
 * 4 dígitos), com o hash REAL das respostas — só o banco é trocado por uma versão em
 * memória (state) e o relógio (Date) é controlado.
 */
type FakeAdmin = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  passwordHash: string;
  securityEnabled: boolean;
  securityFriendHash: string | null;
  securityPinHash: string | null;
  sessionsValidAfter: number | null;
};

const state = vi.hoisted(() => ({
  admin: null as unknown as FakeAdmin,
  telegram: [] as string[],
  audit: [] as { action: string; after?: unknown }[],
}));

vi.mock("../../_core/env", () => ({
  ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", platformSessionCookieName: "platform_session", requirePlatform2fa: false },
}));
vi.mock("../../_core/platformPassword", () => ({
  // Senha "senha-certa" é a única válida — sem scrypt de verdade pra senha nos testes de fluxo.
  verifyPlatformPassword: async (password: string) => password === "senha-certa",
}));
vi.mock("../../db/auditLog", () => ({ recordPlatformAuditLog: async (entry: { action: string; after?: unknown }) => { state.audit.push(entry); } }));
vi.mock("../../_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("../../_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: (text: string) => { state.telegram.push(text); } };
});
vi.mock("../../db/platformAdmins", () => ({
  authenticatePlatformAdmin: async (email: string, password: string) =>
    email === state.admin.email && password === "senha-certa"
      ? { ok: true, admin: { id: state.admin.id, name: state.admin.name, email: state.admin.email, securityEnabled: state.admin.securityEnabled } }
      : { ok: false, knownAdmin: null },
  markPlatformAdminSignedIn: async () => undefined,
}));
vi.mock("../../db/platformAdminSecurity", () => ({
  getPlatformAdminSecurityRecord: async (id: number) => (state.admin.id === id ? { ...state.admin } : undefined),
  setPlatformAdminSecurityAnswers: async (_id: number, hashes: { friendHash: string; pinHash: string }) => {
    Object.assign(state.admin, { securityEnabled: true, securityFriendHash: hashes.friendHash, securityPinHash: hashes.pinHash, sessionsValidAfter: Math.floor(Date.now() / 1000) });
  },
  clearPlatformAdminSecurityAnswers: async () => {
    Object.assign(state.admin, { securityEnabled: false, securityFriendHash: null, securityPinHash: null, sessionsValidAfter: Math.floor(Date.now() / 1000) });
  },
  revokeAllPlatformAdminSessions: async () => { state.admin.sessionsValidAfter = Math.floor(Date.now() / 1000); },
}));

import { masterPanelAuthRouter } from "./auth";
import { masterPanelSecurityRouter } from "./security";
import { verifyPlatformSessionToken } from "../../_core/platformSession";

let nextAdminId = 2000;
let nextIp = 1;

function freshAdmin(): FakeAdmin {
  // id novo por teste: os contadores de rate limit são globais do processo e usam o id como chave.
  const id = nextAdminId++;
  return { id, name: "Dono", email: `dono${id}@exemplo.com`, active: true, passwordHash: "x", securityEnabled: false, securityFriendHash: null, securityPinHash: null, sessionsValidAfter: null };
}

function makeCtx(ip: string, withAdmin = false) {
  return {
    req: { ip, headers: { "user-agent": "Teste" }, socket: {} } as unknown as TrpcContext["req"],
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    restaurant: null,
    platformAdmin: withAdmin ? ({ id: state.admin.id, email: state.admin.email, active: true, role: "owner", permissions: [], securityEnabled: state.admin.securityEnabled } as never) : null,
  } as TrpcContext & { res: { cookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } };
}

const auth = (ctx: TrpcContext) => masterPanelAuthRouter.createCaller(ctx);
const security = (ctx: TrpcContext) => masterPanelSecurityRouter.createCaller(ctx);
const ip = () => `198.51.100.${nextIp++}`;

async function enableSecurity(friendAnswer = "Carlos Eduardo", pin = "4821") {
  await security(makeCtx(ip(), true)).setAnswers({ password: "senha-certa", friendAnswer, pin });
}

/** Passo 1 do login: devolve o token pendente (a conta precisa ter a verificação ligada). */
async function loginStep1(callerIp = ip()) {
  const result = await auth(makeCtx(callerIp)).login({ email: state.admin.email, password: "senha-certa" });
  if (!result.requiresSecurity) throw new Error("esperava passo 2");
  return result.pendingToken;
}

beforeEach(() => {
  state.admin = freshAdmin();
  state.telegram = [];
  state.audit = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cadastrar a pergunta e o código", () => {
  it("grava só hashes (nada em texto puro), liga a verificação, dá sessão nova e audita sem as respostas", async () => {
    const ctx = makeCtx(ip(), true);
    await security(ctx).setAnswers({ password: "senha-certa", friendAnswer: "Carlos Eduardo", pin: "4821" });
    expect(state.admin.securityEnabled).toBe(true);
    for (const stored of [state.admin.securityFriendHash!, state.admin.securityPinHash!]) {
      expect(stored).toMatch(/^v1:/);
      expect(stored.toLowerCase()).not.toContain("carlos");
      expect(stored).not.toContain("4821");
    }
    expect(ctx.res.cookie).toHaveBeenCalled();
    expect(state.audit.map(entry => entry.action)).toContain("admin.security_enabled");
    expect(JSON.stringify(state.audit)).not.toMatch(/carlos|4821/i);
  });

  it("senha atual errada: recusa e não grava nada", async () => {
    await expect(security(makeCtx(ip(), true)).setAnswers({ password: "errada", friendAnswer: "Carlos", pin: "4821" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.admin.securityEnabled).toBe(false);
    expect(state.admin.securityFriendHash).toBeNull();
  });

  it("o código precisa ter exatamente 4 números", async () => {
    for (const pin of ["123", "12345", "12a4", "abcd"]) {
      await expect(security(makeCtx(ip(), true)).setAnswers({ password: "senha-certa", friendAnswer: "Carlos", pin })).rejects.toThrow();
    }
    expect(state.admin.securityEnabled).toBe(false);
  });

  it("status informa a pergunta e se está ativa, sem devolver hash", async () => {
    await enableSecurity();
    const status = await security(makeCtx(ip(), true)).status();
    expect(status).toEqual({ securityEnabled: true, securityRequired: false, question: expect.stringContaining("melhor amigo de infância") });
  });
});

describe("login com a verificação ligada", () => {
  it("sem a verificação cadastrada, a senha basta (como antes)", async () => {
    const ctx = makeCtx(ip());
    const result = await auth(ctx).login({ email: state.admin.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresSecurity: false });
    expect(ctx.res.cookie).toHaveBeenCalled();
  });

  it("com a verificação: a senha NÃO abre sessão, só devolve o token pendente", async () => {
    await enableSecurity();
    const ctx = makeCtx(ip());
    const result = await auth(ctx).login({ email: state.admin.email, password: "senha-certa" });
    expect(result).toMatchObject({ requiresSecurity: true, pendingToken: expect.any(String) });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("resposta e código certos (mesmo com acento/caixa diferentes): abre sessão e o alerta do Telegram diz que passou pela verificação", async () => {
    await enableSecurity("José Antônio", "0042");
    const pendingToken = await loginStep1();
    const ctx = makeCtx(ip());
    const result = await auth(ctx).verifySecurity({ pendingToken, friendAnswer: "  jose  ANTONIO ", pin: "0042" });
    expect(result).toMatchObject({ requiresSecurity: false, email: state.admin.email });
    const [, token] = ctx.res.cookie.mock.calls[0] ?? [];
    expect(await verifyPlatformSessionToken(token as string)).toMatchObject({ adminId: state.admin.id });
    expect(state.telegram.at(-1)).toContain("sim");
    expect(state.audit.map(entry => entry.action)).toContain("admin.login_success");
  });

  it("código errado ou nome errado: mesma mensagem (não revela qual), sem sessão e com auditoria", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    const messages: string[] = [];
    for (const attempt of [{ friendAnswer: "Carlos Eduardo", pin: "0000" }, { friendAnswer: "Outro", pin: "4821" }, { friendAnswer: "Outro", pin: "0000" }]) {
      const pendingToken = await loginStep1();
      const ctx = makeCtx(ip());
      const error = await auth(ctx).verifySecurity({ pendingToken, ...attempt }).catch(caught => caught);
      expect(error).toMatchObject({ code: "UNAUTHORIZED" });
      messages.push(error.message);
      expect(ctx.res.cookie).not.toHaveBeenCalled();
    }
    expect(new Set(messages).size).toBe(1);
    expect(state.audit.filter(entry => entry.action === "admin.security_failed")).toHaveLength(3);
  });

  it("token pendente inválido é recusado", async () => {
    await enableSecurity();
    await expect(auth(makeCtx(ip())).verifySecurity({ pendingToken: "lixo", friendAnswer: "Carlos Eduardo", pin: "4821" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("só 5 tentativas por conta: a sexta é barrada mesmo com as respostas certas", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    const pendingToken = await loginStep1();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await auth(makeCtx(ip())).verifySecurity({ pendingToken, friendAnswer: "Errado", pin: "0000" }).catch(() => undefined);
    }
    await expect(auth(makeCtx(ip())).verifySecurity({ pendingToken, friendAnswer: "Carlos Eduardo", pin: "4821" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("sessões revogadas depois do passo 1: o token pendente deixa de valer", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    const pendingToken = await loginStep1();
    vi.setSystemTime(new Date("2026-10-10T12:01:00Z"));
    await security(makeCtx(ip(), true)).revokeAllSessions();
    await expect(auth(makeCtx(ip())).verifySecurity({ pendingToken, friendAnswer: "Carlos Eduardo", pin: "4821" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("trocar e desativar", () => {
  it("trocar exige as respostas ATUAIS: sem elas (ou erradas) recusa e mantém as antigas", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    const before = { ...state.admin };
    await expect(security(makeCtx(ip(), true)).setAnswers({ password: "senha-certa", friendAnswer: "Novo Amigo", pin: "1111" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(security(makeCtx(ip(), true)).setAnswers({ password: "senha-certa", friendAnswer: "Novo Amigo", pin: "1111", current: { friendAnswer: "Carlos Eduardo", pin: "0000" } })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.admin.securityFriendHash).toBe(before.securityFriendHash);
  });

  it("trocar com as atuais certas: o login passa a valer com as novas e as antigas deixam de valer", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    await security(makeCtx(ip(), true)).setAnswers({ password: "senha-certa", friendAnswer: "Novo Amigo", pin: "1111", current: { friendAnswer: "Carlos Eduardo", pin: "4821" } });
    expect(state.audit.map(entry => entry.action)).toContain("admin.security_changed");
    await expect(auth(makeCtx(ip())).verifySecurity({ pendingToken: await loginStep1(), friendAnswer: "Carlos Eduardo", pin: "4821" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(auth(makeCtx(ip())).verifySecurity({ pendingToken: await loginStep1(), friendAnswer: "Novo Amigo", pin: "1111" })).resolves.toMatchObject({ requiresSecurity: false });
  });

  it("desativar exige senha + respostas atuais; depois, a senha sozinha volta a bastar", async () => {
    await enableSecurity("Carlos Eduardo", "4821");
    await expect(security(makeCtx(ip(), true)).disable({ password: "senha-certa", current: { friendAnswer: "Errado", pin: "4821" } })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.admin.securityEnabled).toBe(true);
    await security(makeCtx(ip(), true)).disable({ password: "senha-certa", current: { friendAnswer: "Carlos Eduardo", pin: "4821" } });
    expect(state.admin).toMatchObject({ securityEnabled: false, securityFriendHash: null, securityPinHash: null });
    expect(await auth(makeCtx(ip())).login({ email: state.admin.email, password: "senha-certa" })).toMatchObject({ requiresSecurity: false });
  });
});
