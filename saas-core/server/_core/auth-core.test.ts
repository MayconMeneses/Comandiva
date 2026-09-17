import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

/**
 * Cobertura de regressão pro núcleo de autenticação do Painel Master
 * (verifyPlatformSessionToken, operatorProcedure, restaurantProcedure e
 * hashApiKey). O 2FA (TOTP) em si — geração/validação de código, fluxo de
 * setup, dispositivo confiável — tem cobertura própria em
 * server/routers/masterPanel/auth.test.ts e server/_core/totp.test.ts.
 * Tudo com mocks simples, sem subir servidor HTTP real: os middlewares tRPC
 * são exercitados criando um router mínimo e chamando `.createCaller(ctx)`
 * com um `TrpcContext` montado à mão, mesmo padrão já usado em
 * `team-privilege-escalation.test.ts`.
 */

// Secret determinístico só pro teste — nunca o valor real de produção.
// platformSession.ts lê `ENV.platformJwtSecret` a cada chamada (não é uma
// constante de módulo), então mockar `./env` aqui é suficiente pra
// createPlatformSessionToken/verifyPlatformSessionToken usarem este valor.
// Precisa estar dentro de vi.hoisted porque a factory do vi.mock abaixo é
// içada pro topo do arquivo, antes de qualquer `const` normal.
const { dbMocks, TEST_JWT_SECRET } = vi.hoisted(() => ({
  dbMocks: {
    getRestaurantByApiKeyHash: vi.fn(),
    getPlatformAdminById: vi.fn(),
  },
  TEST_JWT_SECRET: "test-only-platform-secret-32-chars-min",
}));

vi.mock("./env", () => ({
  ENV: {
    platformJwtSecret: TEST_JWT_SECRET,
    operatorToken: "",
    platformSessionCookieName: "platform_session",
  },
}));

// Mantém hashApiKey e o resto do módulo REAIS (é a função que queremos
// testar de verdade) — só troca a busca no banco por um mock controlável,
// já que getDb() tentaria uma conexão MySQL real se chamada.
vi.mock("../db/restaurants", async importOriginal => {
  const actual = await importOriginal<typeof import("../db/restaurants")>();
  return { ...actual, getRestaurantByApiKeyHash: dbMocks.getRestaurantByApiKeyHash };
});

vi.mock("../db/platformAdmins", () => ({
  getPlatformAdminById: dbMocks.getPlatformAdminById,
}));

import { ENV } from "./env";
import { createPlatformSessionToken, verifyPlatformSessionToken } from "./platformSession";
import { createContext, type TrpcContext } from "./context";
import { operatorProcedure, restaurantProcedure, router } from "./trpc";
import { hashApiKey } from "./apiKey";

const SECRET_BYTES = new TextEncoder().encode(TEST_JWT_SECRET);
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

// Constrói um JWT com header/payload arbitrários e SEM assinatura (alg
// "none") — jose recusa assinar isso via SignJWT de propósito, então
// precisa ser montado manualmente pra simular o ataque clássico de
// confusão de algoritmo.
function unsignedNoneAlgToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${base64url({ alg: "none", typ: "JWT" })}.${base64url(payload)}.`;
}

describe("verifyPlatformSessionToken", () => {
  it("aceita um token válido assinado com o secret certo", async () => {
    const token = await createPlatformSessionToken(7, "admin@mmsystemcreator.com.br");
    await expect(verifyPlatformSessionToken(token)).resolves.toEqual({ adminId: 7, email: "admin@mmsystemcreator.com.br" });
  });

  it("rejeita token undefined/ausente", async () => {
    await expect(verifyPlatformSessionToken(undefined)).resolves.toBeNull();
  });

  it("rejeita token expirado", async () => {
    const token = await new SignJWT({ adminId: 1, email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(SECRET_BYTES);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("rejeita token assinado com secret errado (mesmo com payload/alg corretos)", async () => {
    const wrongSecret = new TextEncoder().encode("um-secret-completamente-diferente-do-real");
    const token = await new SignJWT({ adminId: 1, email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(inOneHour())
      .sign(wrongSecret);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("rejeita token com alg 'none' (confusão de algoritmo — verify restringe a HS256)", async () => {
    const token = unsignedNoneAlgToken({ adminId: 1, email: "a@b.com", exp: inOneHour() });
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("rejeita payload sem adminId", async () => {
    const token = await new SignJWT({ email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(inOneHour())
      .sign(SECRET_BYTES);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("rejeita payload sem email", async () => {
    const token = await new SignJWT({ adminId: 1 })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(inOneHour())
      .sign(SECRET_BYTES);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("rejeita adminId de tipo errado (string em vez de number)", async () => {
    const token = await new SignJWT({ adminId: "7", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(inOneHour())
      .sign(SECRET_BYTES);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });
});

describe("operatorProcedure", () => {
  const testRouter = router({ ping: operatorProcedure.query(() => "pong") });

  function ctxWithHeader(headerValue: string | undefined): TrpcContext {
    return {
      req: { headers: headerValue === undefined ? {} : { "x-operator-token": headerValue } } as unknown as TrpcContext["req"],
      res: {} as unknown as TrpcContext["res"],
      restaurant: null,
      platformAdmin: null,
    };
  }

  beforeEach(() => {
    ENV.operatorToken = "";
  });

  it("rejeita quando não há header x-operator-token nenhum", async () => {
    ENV.operatorToken = "token-configurado-certo";
    const caller = testRouter.createCaller(ctxWithHeader(undefined));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita header com valor errado", async () => {
    ENV.operatorToken = "token-configurado-certo";
    const caller = testRouter.createCaller(ctxWithHeader("token-invasor"));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita header vazio", async () => {
    ENV.operatorToken = "token-configurado-certo";
    const caller = testRouter.createCaller(ctxWithHeader(""));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("falha fechado quando OPERATOR_TOKEN não está configurado — nunca aberto, mesmo se o header vier igualmente vazio", async () => {
    ENV.operatorToken = "";
    const caller = testRouter.createCaller(ctxWithHeader(""));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("aceita quando o header bate exatamente com OPERATOR_TOKEN configurado", async () => {
    ENV.operatorToken = "token-configurado-certo";
    const caller = testRouter.createCaller(ctxWithHeader("token-configurado-certo"));
    await expect(caller.ping()).resolves.toBe("pong");
  });
});

describe("hashApiKey", () => {
  it("é determinístico para a mesma chave", () => {
    expect(hashApiKey("rk_live_abc123")).toBe(hashApiKey("rk_live_abc123"));
  });

  it("produz hashes diferentes para chaves diferentes", () => {
    expect(hashApiKey("rk_live_abc123")).not.toBe(hashApiKey("rk_live_xyz789"));
  });
});

describe("restaurantProcedure", () => {
  const testRouter = router({
    ping: restaurantProcedure.query(({ ctx }) => ctx.restaurant.id),
  });

  function ctxWithRestaurant(restaurant: TrpcContext["restaurant"]): TrpcContext {
    return {
      req: { headers: {} } as unknown as TrpcContext["req"],
      res: {} as unknown as TrpcContext["res"],
      restaurant,
      platformAdmin: null,
    };
  }

  it("rejeita quando nenhum restaurante foi resolvido (chave de API errada/inexistente)", async () => {
    const caller = testRouter.createCaller(ctxWithRestaurant(null));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejeita restaurante inativo mesmo com a chave certa (ctx.restaurant já resolvido, status != active)", async () => {
    const caller = testRouter.createCaller(ctxWithRestaurant({ id: 5, status: "suspended" } as unknown as TrpcContext["restaurant"]));
    await expect(caller.ping()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("aceita restaurante ativo", async () => {
    const caller = testRouter.createCaller(ctxWithRestaurant({ id: 5, status: "active" } as unknown as TrpcContext["restaurant"]));
    await expect(caller.ping()).resolves.toBe(5);
  });
});

describe("createContext — resolução de identidade (API key x cookie de sessão)", () => {
  beforeEach(() => {
    dbMocks.getRestaurantByApiKeyHash.mockReset();
    dbMocks.getPlatformAdminById.mockReset();
  });

  function fakeExpressOpts(headers: Record<string, string | undefined>) {
    return { req: { headers }, res: {} } as unknown as Parameters<typeof createContext>[0];
  }

  it("resolve restaurant a partir do header 'Authorization: Bearer <key>', hasheando antes de consultar o banco", async () => {
    dbMocks.getRestaurantByApiKeyHash.mockResolvedValue({ id: 3, status: "active" });
    const ctx = await createContext(fakeExpressOpts({ authorization: "Bearer rk_live_abc123" }));
    expect(ctx.restaurant).toEqual({ id: 3, status: "active" });
    expect(dbMocks.getRestaurantByApiKeyHash).toHaveBeenCalledWith(hashApiKey("rk_live_abc123"));
  });

  it("não tenta resolver restaurant sem o prefixo 'Bearer '", async () => {
    const ctx = await createContext(fakeExpressOpts({ authorization: "rk_live_abc123" }));
    expect(ctx.restaurant).toBeNull();
    expect(dbMocks.getRestaurantByApiKeyHash).not.toHaveBeenCalled();
  });

  it("restaurant fica null quando o hash não bate em nenhum registro", async () => {
    dbMocks.getRestaurantByApiKeyHash.mockResolvedValue(undefined);
    const ctx = await createContext(fakeExpressOpts({ authorization: "Bearer chave-que-nao-existe" }));
    expect(ctx.restaurant).toBeNull();
  });

  it("resolve platformAdmin a partir do cookie de sessão, e não do header Authorization", async () => {
    const token = await createPlatformSessionToken(9, "dono@mmsystemcreator.com.br");
    dbMocks.getPlatformAdminById.mockResolvedValue({ id: 9, active: true });
    const ctx = await createContext(fakeExpressOpts({ cookie: `platform_session=${token}` }));
    expect(ctx.platformAdmin).toEqual({ id: 9, active: true });
    expect(ctx.restaurant).toBeNull();
  });

  it("uma API key de restaurante válida nunca preenche platformAdmin (canais nunca se misturam)", async () => {
    dbMocks.getRestaurantByApiKeyHash.mockResolvedValue({ id: 3, status: "active" });
    const ctx = await createContext(fakeExpressOpts({ authorization: "Bearer rk_live_abc123" }));
    expect(ctx.platformAdmin).toBeNull();
    expect(dbMocks.getPlatformAdminById).not.toHaveBeenCalled();
  });
});
