import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "../../shared/const";

// Núcleo de autenticação (verifySession/authenticateRequest) hoje sem
// nenhuma cobertura automatizada — ver pedido que motivou este arquivo:
// revogação de sessão pra conta staff/admin pausada (team.setActive).
const mocks = vi.hoisted(() => {
  // Precisa rodar antes de "./env" ser importado (via "./sdk") pra
  // ENV.cookieSecret não ficar vazio — vi.hoisted é elevado acima dos
  // imports estáticos do arquivo, diferente de uma atribuição solta aqui.
  process.env.JWT_SECRET ||= "test-only-jwt-secret-com-pelo-menos-32-caracteres";
  return {
    getUserByOpenId: vi.fn(),
    upsertUser: vi.fn().mockResolvedValue(undefined),
    getStaffCredentialActiveStatus: vi.fn(),
  };
});

vi.mock("../db", () => ({
  getUserByOpenId: mocks.getUserByOpenId,
  upsertUser: mocks.upsertUser,
  getStaffCredentialActiveStatus: mocks.getStaffCredentialActiveStatus,
}));

const { sdk } = await import("./sdk");

function makeUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 1,
    openId: "restaurant_admin_test",
    name: "Admin Teste",
    email: null,
    loginMethod: "restaurant",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    ...overrides,
  } as User;
}

function requestWithCookie(token: string | undefined, extraHeaders: Record<string, string> = {}): Request {
  return {
    headers: { cookie: token ? `${COOKIE_NAME}=${token}` : "", ...extraHeaders },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SessionService.verifySession", () => {
  it("aceita um token recém-assinado e devolve o payload", async () => {
    const token = await sdk.createSessionToken("open-1", { name: "Fulano" });
    await expect(sdk.verifySession(token)).resolves.toEqual({
      openId: "open-1",
      appId: expect.any(String),
      name: "Fulano",
    });
  });

  it("rejeita ausência de token", async () => {
    await expect(sdk.verifySession(undefined)).resolves.toBeNull();
    await expect(sdk.verifySession(null)).resolves.toBeNull();
    await expect(sdk.verifySession("")).resolves.toBeNull();
  });

  it("rejeita token expirado", async () => {
    const token = await sdk.signSession(
      { openId: "open-1", appId: "pubx-local", name: "Fulano" },
      { expiresInMs: -1000 },
    );
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("rejeita token assinado com secret errado", async () => {
    const wrongSecret = new TextEncoder().encode("outro-segredo-completamente-diferente-do-real");
    const token = await new SignJWT({ openId: "open-1", appId: "pubx-local", name: "Fulano" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
      .sign(wrongSecret);
    await expect(sdk.verifySession(token)).resolves.toBeNull();
  });

  it("rejeita payload incompleto (openId/appId/name ausentes)", async () => {
    const secret = (sdk as unknown as { getSessionSecret(): Uint8Array }).getSessionSecret();
    const incompletePayloads = [
      { appId: "pubx-local", name: "Fulano" }, // sem openId
      { openId: "open-1", name: "Fulano" }, // sem appId
      { openId: "open-1", appId: "pubx-local" }, // sem name
      {}, // vazio
      { openId: "", appId: "pubx-local", name: "Fulano" }, // openId vazio não conta
    ];

    for (const payload of incompletePayloads) {
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setExpirationTime(Math.floor((Date.now() + 60_000) / 1000))
        .sign(secret);
      await expect(sdk.verifySession(token)).resolves.toBeNull();
    }
  });
});

describe("SessionService.authenticateRequest", () => {
  it("autentica normalmente uma conta staff/admin ativa", async () => {
    mocks.getUserByOpenId.mockResolvedValue(makeUser());
    mocks.getStaffCredentialActiveStatus.mockResolvedValue(true);
    const token = await sdk.createSessionToken("restaurant_admin_test", { name: "Admin Teste" });

    const user = await sdk.authenticateRequest(requestWithCookie(token));

    expect(user.openId).toBe("restaurant_admin_test");
    expect(mocks.getStaffCredentialActiveStatus).toHaveBeenCalledWith(1);
  });

  it("rejeita quando não há sessão nenhuma (sem cookie e sem Bearer)", async () => {
    await expect(sdk.authenticateRequest(requestWithCookie(undefined))).rejects.toThrow("Sessão inválida");
  });

  it("aceita sessão via Authorization: Bearer quando não há cookie", async () => {
    mocks.getUserByOpenId.mockResolvedValue(makeUser());
    mocks.getStaffCredentialActiveStatus.mockResolvedValue(true);
    const token = await sdk.createSessionToken("restaurant_admin_test", { name: "Admin Teste" });

    const user = await sdk.authenticateRequest(requestWithCookie(undefined, { authorization: `Bearer ${token}` }));

    expect(user.openId).toBe("restaurant_admin_test");
  });

  it("rejeita quando o usuário do token não existe mais no banco", async () => {
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    const token = await sdk.createSessionToken("open-inexistente", { name: "Fulano" });

    await expect(sdk.authenticateRequest(requestWithCookie(token))).rejects.toThrow("Usuário não encontrado");
  });

  it("REGRESSÃO: revoga sessão de conta staff/admin pausada mesmo com token ainda válido", async () => {
    mocks.getUserByOpenId.mockResolvedValue(makeUser({ role: "staff" }));
    mocks.getStaffCredentialActiveStatus.mockResolvedValue(false);
    const token = await sdk.createSessionToken("restaurant_admin_test", { name: "Staff Teste" });

    await expect(sdk.authenticateRequest(requestWithCookie(token))).rejects.toThrow("Sessão inválida");
  });

  it("não bloqueia quando a credencial staff/admin não foi encontrada (undefined não é revogação)", async () => {
    mocks.getUserByOpenId.mockResolvedValue(makeUser({ role: "admin" }));
    mocks.getStaffCredentialActiveStatus.mockResolvedValue(undefined);
    const token = await sdk.createSessionToken("restaurant_admin_test", { name: "Admin Teste" });

    const user = await sdk.authenticateRequest(requestWithCookie(token));
    expect(user.role).toBe("admin");
  });

  it("não checa credencial de staff/admin pra um usuário comum (role 'user')", async () => {
    mocks.getUserByOpenId.mockResolvedValue(makeUser({ role: "user" }));
    const token = await sdk.createSessionToken("restaurant_admin_test", { name: "Cliente" });

    const user = await sdk.authenticateRequest(requestWithCookie(token));

    expect(user.role).toBe("user");
    expect(mocks.getStaffCredentialActiveStatus).not.toHaveBeenCalled();
  });
});
