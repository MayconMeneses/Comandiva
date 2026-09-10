import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Cobertura que faltava (auditoria V-13): o único teste existente de Modo
 * Suporte (support-mode-access.test.ts) injeta a sessão já pronta no
 * contexto, pulando inteiramente a troca de token real — a cadeia
 * fetch → parse → assinatura do próprio JWT nunca era exercitada. Mocka só
 * `fetch` (não o módulo de sessão), do jeito que a auditoria recomendou.
 */
// Importar ./routers carrega o appRouter inteiro, incluindo server/_core/license.ts
// — que dispara uma sincronização automática no boot quando saasCoreUrl/
// saasCoreApiKey estão preenchidos (precisamos disso pra habilitar o Modo
// Suporte). licenseSyncIntervalMs bem alto evita que o setInterval real
// desse módulo fique reagendando (undefined vira 0ms) e martelando fetch
// durante o teste inteiro.
vi.mock("./_core/env", () => ({
  ENV: {
    supportSessionSecret: "segredo-de-teste-bem-longo-1234567890",
    saasCoreUrl: "https://saas-core.test",
    saasCoreApiKey: "test-key",
    licenseSyncIntervalMs: 999_999_999,
  },
}));

// Mockado ANTES do import — evita que a sincronização automática de boot
// (disparada ao carregar ./routers, ver comentário acima) faça uma
// resolução DNS real contra "saas-core.test".
global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
const { appRouter } = await import("./routers");
const { verifySupportSessionToken } = await import("./_core/supportSession");

function contextFromIp(ip: string): TrpcContext {
  return { user: null, req: { ip, protocol: "https", headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as unknown as TrpcContext;
}

const validRedeemBody = {
  result: { data: { supportSessionId: 42, restaurantName: "Pub X (teste)", platformAdminEmail: "dono@plataforma.com", expiresAt: Date.now() + 10 * 60_000 } },
};

describe("support.enter — troca de token de handoff por sessão local", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("token válido: troca por sessão, grava cookie com JWT que verifica de volta pros mesmos dados", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => validRedeemBody });
    const ctx = contextFromIp("203.0.113.40");

    const result = await appRouter.createCaller(ctx).support.enter({ token: "a".repeat(24) });

    expect(result).toEqual({ success: true, restaurantName: "Pub X (teste)", expiresAt: validRedeemBody.result.data.expiresAt });
    const cookieMock = ctx.res.cookie as unknown as ReturnType<typeof vi.fn>;
    expect(cookieMock).toHaveBeenCalled();
    const [, token] = cookieMock.mock.calls[0] as [string, string];
    const payload = await verifySupportSessionToken(token);
    expect(payload).toMatchObject({ supportSessionId: 42, restaurantName: "Pub X (teste)", platformAdminEmail: "dono@plataforma.com" });
  });

  it("saas-core rejeita o token (link expirado/já usado): FORBIDDEN, nenhum cookie gravado", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });
    const ctx = contextFromIp("203.0.113.41");

    await expect(appRouter.createCaller(ctx).support.enter({ token: "a".repeat(24) })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("saas-core responde formato inesperado: rejeita fechado, nenhum cookie gravado", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ result: { data: { supportSessionId: "não é número" } } }) });
    const ctx = contextFromIp("203.0.113.42");

    await expect(appRouter.createCaller(ctx).support.enter({ token: "a".repeat(24) })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it("bloqueia após muitas tentativas do mesmo IP (defesa própria, além do que o saas-core fizer)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });
    const ip = "203.0.113.43";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await appRouter.createCaller(contextFromIp(ip)).support.enter({ token: "a".repeat(24) }).catch(() => undefined);
    }
    await expect(appRouter.createCaller(contextFromIp(ip)).support.enter({ token: "a".repeat(24) })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});

/** Ver auditoria V-13: expiração e token adulterado nunca tinham teste unitário próprio. */
describe("createSupportSessionToken / verifySupportSessionToken", () => {
  it("token adulterado (assinatura não bate) é rejeitado", async () => {
    const { createSupportSessionToken } = await import("./_core/supportSession");
    const token = await createSupportSessionToken({ supportSessionId: 1, restaurantName: "X", platformAdminEmail: "a@b.com", expiresAt: Date.now() + 60_000 });
    const tampered = token.slice(0, -4) + "abcd";
    await expect(verifySupportSessionToken(tampered)).resolves.toBeNull();
  });

  it("token expirado é rejeitado", async () => {
    const { createSupportSessionToken } = await import("./_core/supportSession");
    const token = await createSupportSessionToken({ supportSessionId: 1, restaurantName: "X", platformAdminEmail: "a@b.com", expiresAt: Date.now() - 1000 });
    await expect(verifySupportSessionToken(token)).resolves.toBeNull();
  });

  it("sem cookie nenhum: null, sem lançar", async () => {
    await expect(verifySupportSessionToken(undefined)).resolves.toBeNull();
  });
});
