import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fiação do createContext: sessão de suporte inativa no master vira "sem suporte" e o cookie é apagado. */
const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  verifySupportSessionToken: vi.fn(),
  isSupportSessionStillActive: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./_core/supportSession", () => ({
  verifySupportSessionToken: mocks.verifySupportSessionToken,
  isSupportSessionStillActive: mocks.isSupportSessionStillActive,
}));
vi.mock("./_core/env", () => ({ ENV: { cookieSecure: false } }));

import { createContext } from "./_core/context";

const payload = { supportSessionId: 5, restaurantName: "Teste", platformAdminEmail: "a@x.com", expiresAt: Date.now() + 60_000 };

function options() {
  const clearCookie = vi.fn();
  const opts = { req: { headers: { cookie: "support_session_id=abc" }, protocol: "https" }, res: { clearCookie } };
  return { opts: opts as never, clearCookie };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateRequest.mockRejectedValue(new Error("sem login"));
});

describe("createContext — Modo Suporte revalidado no master", () => {
  it("sessão ativa continua valendo", async () => {
    mocks.verifySupportSessionToken.mockResolvedValue(payload);
    mocks.isSupportSessionStillActive.mockResolvedValue(true);
    const { opts, clearCookie } = options();
    const ctx = await createContext(opts);
    expect(ctx.supportSession).toEqual(payload);
    expect(clearCookie).not.toHaveBeenCalled();
    expect(mocks.isSupportSessionStillActive).toHaveBeenCalledWith(5);
  });

  it("sessão encerrada no master: sem suporte e cookie apagado", async () => {
    mocks.verifySupportSessionToken.mockResolvedValue(payload);
    mocks.isSupportSessionStillActive.mockResolvedValue(false);
    const { opts, clearCookie } = options();
    const ctx = await createContext(opts);
    expect(ctx.supportSession).toBeNull();
    expect(clearCookie).toHaveBeenCalledOnce();
  });

  it("sem cookie de suporte válido, nem consulta o master", async () => {
    mocks.verifySupportSessionToken.mockResolvedValue(null);
    const { opts } = options();
    const ctx = await createContext(opts);
    expect(ctx.supportSession).toBeNull();
    expect(mocks.isSupportSessionStillActive).not.toHaveBeenCalled();
  });
});
