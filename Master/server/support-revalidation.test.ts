import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Modo Suporte (auditoria 2026-10-10): o deployment confirma a sessão no master,
 * o master consegue ENCERRAR uma sessão, o link só vale poucos minutos e é
 * entregue no fragmento da URL (#token=), não na query.
 */
const mocks = vi.hoisted(() => ({
  getOwnSupportSession: vi.fn(),
  getSupportSessionById: vi.fn(),
  getSupportSessionByIdAnyRestaurant: vi.fn(),
  listActiveSupportSessions: vi.fn(),
  markSupportSessionUsed: vi.fn(),
  markSupportSessionEnded: vi.fn(),
  createSupportSession: vi.fn(),
  getPlatformAdminById: vi.fn(),
  getRestaurantById: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
  sendTelegramMessageAsync: vi.fn(),
}));

vi.mock("./db/supportSessions", () => ({
  getOwnSupportSession: mocks.getOwnSupportSession,
  getSupportSessionById: mocks.getSupportSessionById,
  getSupportSessionByIdAnyRestaurant: mocks.getSupportSessionByIdAnyRestaurant,
  listActiveSupportSessions: mocks.listActiveSupportSessions,
  markSupportSessionUsed: mocks.markSupportSessionUsed,
  markSupportSessionEnded: mocks.markSupportSessionEnded,
  createSupportSession: mocks.createSupportSession,
}));
vi.mock("./db/platformAdmins", () => ({ getPlatformAdminById: mocks.getPlatformAdminById }));
vi.mock("./db/restaurants", () => ({ getRestaurantById: mocks.getRestaurantById }));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("./_core/telegramService", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/telegramService")>()),
  sendTelegramMessageAsync: mocks.sendTelegramMessageAsync,
}));

import { SUPPORT_REDEEM_WINDOW_MS, supportRouter } from "./routers/support";
import { masterPanelSupportRouter } from "./routers/masterPanel/support";

const RAW_TOKEN = `sup_${"b".repeat(64)}`;
const now = () => Date.now();

function restaurantContext(restaurantId: number): TrpcContext {
  return { restaurant: { id: restaurantId, name: "Pizzaria", status: "active" }, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}
function masterContext(permissions: string[] = ["modo_suporte"]): TrpcContext {
  return { platformAdmin: { id: 1, email: "dono@plataforma.com", role: "owner", active: true, permissions }, req: { ip: "198.51.100.7" }, res: {} } as unknown as TrpcContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPlatformAdminById.mockResolvedValue({ id: 1, email: "dono@plataforma.com", active: true });
  mocks.markSupportSessionUsed.mockResolvedValue(true);
});

describe("support.checkSession (chamado pelo deployment do restaurante)", () => {
  const liveSession = { id: 9, restaurantId: 1, platformAdminId: 1, usedAt: now() - 1000, endedAt: null, expiresAt: now() + 60_000 };

  it("sessão resgatada, não encerrada e dentro do prazo: ativa", async () => {
    mocks.getSupportSessionById.mockResolvedValue(liveSession);
    await expect(supportRouter.createCaller(restaurantContext(1)).checkSession({ supportSessionId: 9 })).resolves.toEqual({ active: true });
    expect(mocks.getSupportSessionById).toHaveBeenCalledWith(1, 9);
  });

  it.each([
    ["encerrada", { ...liveSession, endedAt: now() }],
    ["nunca resgatada", { ...liveSession, usedAt: null }],
    ["expirada", { ...liveSession, expiresAt: now() - 1 }],
  ])("sessão %s: inativa", async (_label, session) => {
    mocks.getSupportSessionById.mockResolvedValue(session);
    await expect(supportRouter.createCaller(restaurantContext(1)).checkSession({ supportSessionId: 9 })).resolves.toEqual({ active: false });
  });

  it("sessão de outro restaurante (não encontrada pelo filtro da API key): inativa", async () => {
    mocks.getSupportSessionById.mockResolvedValue(undefined);
    await expect(supportRouter.createCaller(restaurantContext(2)).checkSession({ supportSessionId: 9 })).resolves.toEqual({ active: false });
    expect(mocks.getSupportSessionById).toHaveBeenCalledWith(2, 9);
  });

  it("admin que abriu a sessão foi pausado: inativa na hora", async () => {
    mocks.getSupportSessionById.mockResolvedValue(liveSession);
    mocks.getPlatformAdminById.mockResolvedValue({ id: 1, email: "dono@plataforma.com", active: false });
    await expect(supportRouter.createCaller(restaurantContext(1)).checkSession({ supportSessionId: 9 })).resolves.toEqual({ active: false });
  });
});

describe("support.redeem — janela curta e admin ativo", () => {
  function stubSession(overrides: Record<string, unknown> = {}) {
    mocks.getOwnSupportSession.mockResolvedValue({ id: 5, restaurantId: 1, platformAdminId: 1, usedAt: null, issuedAt: now(), expiresAt: now() + 15 * 60_000, issuedFromIp: null, ...overrides });
  }

  it("link com mais minutos que a janela de resgate não vale, mesmo dentro dos 15 min da sessão", async () => {
    stubSession({ issuedAt: now() - SUPPORT_REDEEM_WINDOW_MS - 1000 });
    await expect(supportRouter.createCaller(restaurantContext(1)).redeem({ token: RAW_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.markSupportSessionUsed).not.toHaveBeenCalled();
  });

  it("admin pausado depois de emitir o link não consegue resgatá-lo", async () => {
    stubSession();
    mocks.getPlatformAdminById.mockResolvedValue({ id: 1, email: "dono@plataforma.com", active: false });
    await expect(supportRouter.createCaller(restaurantContext(1)).redeem({ token: RAW_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.markSupportSessionUsed).not.toHaveBeenCalled();
  });

  it("link recente e admin ativo: resgata normalmente", async () => {
    stubSession();
    await expect(supportRouter.createCaller(restaurantContext(1)).redeem({ token: RAW_TOKEN })).resolves.toMatchObject({ supportSessionId: 5, platformAdminEmail: "dono@plataforma.com" });
  });
});

describe("Painel Master — emitir, listar e encerrar sessões de suporte", () => {
  it("start entrega o token no FRAGMENTO da URL e registra quem emitiu o link", async () => {
    mocks.getRestaurantById.mockResolvedValue({ id: 3, name: "Pizzaria do Zé", status: "active", deploymentUrl: "https://cliente.exemplo.com/" });
    mocks.createSupportSession.mockResolvedValue({ token: RAW_TOKEN, expiresAt: now() + 900_000 });
    const result = await masterPanelSupportRouter.createCaller(masterContext()).start({ restaurantId: 3 });
    expect(result.entryUrl).toBe(`https://cliente.exemplo.com/suporte/entrar#token=${RAW_TOKEN}`);
    expect(result.entryUrl).not.toContain("?token=");
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "support.link_issued", entityId: 3, ip: "198.51.100.7" }));
  });

  it("start avisa no Telegram quem abriu o Modo Suporte, onde e de que IP — sem o token no aviso", async () => {
    mocks.getRestaurantById.mockResolvedValue({ id: 3, name: "Pizzaria do Zé", status: "active", deploymentUrl: "https://cliente.exemplo.com" });
    mocks.createSupportSession.mockResolvedValue({ token: RAW_TOKEN, expiresAt: now() + 900_000 });
    await masterPanelSupportRouter.createCaller(masterContext()).start({ restaurantId: 3 });
    expect(mocks.sendTelegramMessageAsync).toHaveBeenCalledOnce();
    const text = mocks.sendTelegramMessageAsync.mock.calls[0][0] as string;
    for (const part of ["Modo Suporte iniciado", "dono@plataforma.com", "Pizzaria do Zé", "#3", "198.51.100.7"]) expect(text).toContain(part);
    expect(text).not.toContain(RAW_TOKEN);
  });

  it("end encerra a sessão e audita; sessão inexistente dá NOT_FOUND", async () => {
    mocks.getSupportSessionByIdAnyRestaurant.mockResolvedValue({ id: 9, restaurantId: 3, endedAt: null });
    await masterPanelSupportRouter.createCaller(masterContext()).end({ supportSessionId: 9 });
    expect(mocks.markSupportSessionEnded).toHaveBeenCalledWith(9);
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "support.ended_by_master", entityId: 3 }));

    mocks.getSupportSessionByIdAnyRestaurant.mockResolvedValue(undefined);
    await expect(masterPanelSupportRouter.createCaller(masterContext()).end({ supportSessionId: 99 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("quem não tem a área modo_suporte não lista nem encerra", async () => {
    const caller = masterPanelSupportRouter.createCaller(masterContext(["restaurantes"]));
    await expect(caller.listActive()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.end({ supportSessionId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("listActive devolve restaurante e admin legíveis", async () => {
    mocks.listActiveSupportSessions.mockResolvedValue([{ id: 9, restaurantId: 3, platformAdminId: 1, usedAt: 1, expiresAt: 2 }]);
    mocks.getRestaurantById.mockResolvedValue({ id: 3, name: "Pizzaria do Zé" });
    const list = await masterPanelSupportRouter.createCaller(masterContext()).listActive();
    expect(list).toEqual([{ id: 9, restaurantId: 3, restaurantName: "Pizzaria do Zé", adminEmail: "dono@plataforma.com", usedAt: 1, expiresAt: 2 }]);
  });
});
