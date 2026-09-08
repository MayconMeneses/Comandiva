import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Prova a propriedade mais importante do Modo Suporte: um token de handoff
 * emitido pra um restaurante nunca é resgatável/encerrável por outro
 * restaurante, mesmo que o token em si seja conhecido — o filtro é sempre
 * por ctx.restaurant.id (resolvido da própria API key de quem chama), nunca
 * por um valor enviado no input.
 */
const mocks = vi.hoisted(() => ({
  getOwnSupportSession: vi.fn(),
  getSupportSessionById: vi.fn(),
  markSupportSessionUsed: vi.fn(),
  markSupportSessionEnded: vi.fn(),
  getPlatformAdminById: vi.fn().mockResolvedValue({ id: 1, email: "dono@plataforma.com" }),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db/supportSessions", () => ({
  getOwnSupportSession: mocks.getOwnSupportSession,
  getSupportSessionById: mocks.getSupportSessionById,
  markSupportSessionUsed: mocks.markSupportSessionUsed,
  markSupportSessionEnded: mocks.markSupportSessionEnded,
}));
vi.mock("./db/platformAdmins", () => ({ getPlatformAdminById: mocks.getPlatformAdminById }));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));

import { supportRouter } from "./routers/support";

const RESTAURANT_A_ID = 1;
const RESTAURANT_B_ID = 2;
const RAW_TOKEN = `sup_${"a".repeat(64)}`;

function restaurantContext(restaurantId: number): TrpcContext {
  return { restaurant: { id: restaurantId, status: "active" }, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}

// Simula o comportamento real de getOwnSupportSession: o token só existe pra
// quem tem o restaurantId certo — pedir com outro id nunca encontra a linha.
function stubSessionOwnedBy(ownerRestaurantId: number) {
  mocks.getOwnSupportSession.mockImplementation(async (restaurantId: number, tokenHash: string) => {
    if (restaurantId !== ownerRestaurantId) return undefined;
    return { id: 5, restaurantId: ownerRestaurantId, platformAdminId: 1, tokenHash, usedAt: null, expiresAt: Date.now() + 60_000, issuedFromIp: null };
  });
}

describe("Modo Suporte — isolamento entre restaurantes", () => {
  it("token emitido pro restaurante A não é resgatável usando o contexto do restaurante B", async () => {
    stubSessionOwnedBy(RESTAURANT_A_ID);

    const callerForB = supportRouter.createCaller(restaurantContext(RESTAURANT_B_ID));
    await expect(callerForB.redeem({ token: RAW_TOKEN })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(mocks.getOwnSupportSession).toHaveBeenCalledWith(RESTAURANT_B_ID, expect.any(String));
    expect(mocks.markSupportSessionUsed).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("o mesmo token É resgatável pelo restaurante dono dele (A)", async () => {
    stubSessionOwnedBy(RESTAURANT_A_ID);
    mocks.markSupportSessionUsed.mockResolvedValue(true);

    const callerForA = supportRouter.createCaller(restaurantContext(RESTAURANT_A_ID));
    await expect(callerForA.redeem({ token: RAW_TOKEN })).resolves.toMatchObject({ supportSessionId: 5, platformAdminEmail: "dono@plataforma.com" });

    expect(mocks.markSupportSessionUsed).toHaveBeenCalledWith(5);
    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "support.entered", entityId: RESTAURANT_A_ID }));
  });

  it("resgatar duas vezes o mesmo token falha na segunda (uso único)", async () => {
    stubSessionOwnedBy(RESTAURANT_A_ID);
    mocks.markSupportSessionUsed.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const caller = supportRouter.createCaller(restaurantContext(RESTAURANT_A_ID));
    await expect(caller.redeem({ token: RAW_TOKEN })).resolves.toMatchObject({ supportSessionId: 5 });
    await expect(caller.redeem({ token: RAW_TOKEN })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("logWrite audita uma escrita feita durante a sessão de suporte", async () => {
    mocks.recordPlatformAuditLog.mockClear();
    mocks.getSupportSessionById.mockResolvedValueOnce({ id: 5, restaurantId: RESTAURANT_A_ID, platformAdminId: 1, usedAt: Date.now() - 1000, endedAt: null, issuedFromIp: null });

    const caller = supportRouter.createCaller(restaurantContext(RESTAURANT_A_ID));
    await expect(caller.logWrite({ supportSessionId: 5, procedurePath: "admin.saveProduct" })).resolves.toEqual({ success: true });

    expect(mocks.recordPlatformAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "support.write", entityId: RESTAURANT_A_ID, after: { supportSessionId: 5, procedurePath: "admin.saveProduct" } }));
  });

  it("logWrite é tolerante a sessão já encerrada ou inexistente (não audita)", async () => {
    mocks.recordPlatformAuditLog.mockClear();
    mocks.getSupportSessionById.mockResolvedValueOnce(undefined);

    const caller = supportRouter.createCaller(restaurantContext(RESTAURANT_A_ID));
    await expect(caller.logWrite({ supportSessionId: 999, procedurePath: "admin.saveProduct" })).resolves.toEqual({ success: true });
    expect(mocks.recordPlatformAuditLog).not.toHaveBeenCalled();
  });

  it("token expirado é rejeitado mesmo nunca tendo sido usado", async () => {
    // Limpa histórico dos testes anteriores neste arquivo (sem clearMocks
    // global na config) — só assim dá pra provar que ESTA chamada não marcou uso.
    mocks.markSupportSessionUsed.mockClear();
    mocks.recordPlatformAuditLog.mockClear();
    mocks.getOwnSupportSession.mockResolvedValueOnce({
      id: 5, restaurantId: RESTAURANT_A_ID, platformAdminId: 1, tokenHash: "x", usedAt: null, expiresAt: Date.now() - 1_000, issuedFromIp: null,
    });

    const caller = supportRouter.createCaller(restaurantContext(RESTAURANT_A_ID));
    await expect(caller.redeem({ token: RAW_TOKEN })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(mocks.markSupportSessionUsed).not.toHaveBeenCalled();
    expect(mocks.recordPlatformAuditLog).not.toHaveBeenCalled();
  });
});
