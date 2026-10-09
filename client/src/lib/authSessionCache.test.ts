import "fake-indexeddb/auto";
import { del } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { AUTH_SESSION_MAX_AGE_MS, clearAuthSession, loadAuthSession, saveAuthSession, type AuthUser } from "./authSessionCache";

const KEY = "mm-auth-session";
const STAFF_USER = { id: 1, role: "staff", name: "Equipe", email: "equipe@mm.local", permissions: ["reports"] } as unknown as AuthUser;
const SUPPORT_USER = {
  role: "admin",
  name: "Suporte (dev@plataforma.com)",
  email: "dev@plataforma.com",
  viaSupportSession: true,
  supportRestaurantName: "Comandiva",
  supportExpiresAt: new Date().toISOString(),
  permissions: [],
} as unknown as AuthUser;

describe("authSessionCache — Fase 0 do offline-first do painel", () => {
  beforeEach(async () => {
    await del(KEY);
  });

  it("save → load: devolve o mesmo usuário salvo, com savedAt", async () => {
    const before = Date.now();
    await saveAuthSession(STAFF_USER);
    const result = await loadAuthSession();
    expect(result?.user).toEqual(STAFF_USER);
    expect(result?.savedAt).toBeGreaterThanOrEqual(before);
  });

  it("sem nada salvo ainda: load devolve null", async () => {
    expect(await loadAuthSession()).toBeNull();
  });

  it("cache mais velho que AUTH_SESSION_MAX_AGE_MS (24h): descartado, load devolve null", async () => {
    await saveAuthSession(STAFF_USER);
    const farFuture = Date.now() + AUTH_SESSION_MAX_AGE_MS + 60_000;
    expect(await loadAuthSession(farFuture)).toBeNull();
  });

  it("cache dentro da janela de 24h: continua válido", async () => {
    await saveAuthSession(STAFF_USER);
    const almostExpired = Date.now() + AUTH_SESSION_MAX_AGE_MS - 60_000;
    expect(await loadAuthSession(almostExpired)).not.toBeNull();
  });

  it("clearAuthSession: remove o cache, load volta a devolver null", async () => {
    await saveAuthSession(STAFF_USER);
    await clearAuthSession();
    expect(await loadAuthSession()).toBeNull();
  });

  it("sessão de Modo Suporte NUNCA é persistida, mesmo chamando save explicitamente", async () => {
    await saveAuthSession(SUPPORT_USER);
    expect(await loadAuthSession()).toBeNull();
  });
});
