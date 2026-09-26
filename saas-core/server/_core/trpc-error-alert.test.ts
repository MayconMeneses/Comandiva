import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prova que alertOnUnintentionalInternalError (server/_core/trpc.ts) — a
 * decisão usada dentro do errorFormatter real — dispara alertSystemError
 * quando uma requisição quebra de um jeito inesperado, com a "área" certa
 * (Painel Master / Site comercial / API interna / etc, derivada do namespace
 * do endpoint) pra quem recebe o alerta saber exatamente onde ir olhar.
 *
 * Chama a função extraída diretamente (não createCaller()/HTTP real) de
 * propósito: createCaller() NÃO passa pelo errorFormatter (só o adaptador
 * HTTP de verdade faz isso) — simular uma requisição HTTP completa só pra
 * exercitar essa decisão testaria o roteamento do tRPC, não a lógica nova.
 */
const mocks = vi.hoisted(() => ({ alertSystemError: vi.fn() }));
vi.mock("./telegramService", () => ({ alertSystemError: mocks.alertSystemError }));

const { alertOnUnintentionalInternalError, describeArea } = await import("./trpc");

describe("alertOnUnintentionalInternalError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erro não tratado num endpoint do Painel Master dispara alerta com área 'Painel Master'", () => {
    const cause = new Error("falha inesperada no painel master");
    const result = alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause }, "masterPanel.restaurants.updatePlan");

    expect(result).toBe(true);
    expect(mocks.alertSystemError).toHaveBeenCalledTimes(1);
    const [subject, detail, kind, area] = mocks.alertSystemError.mock.calls[0] as [string, string, string, string];
    expect(subject).toContain("masterPanel.restaurants.updatePlan");
    expect(detail).toBe(cause.stack);
    expect(kind).toBe("trpcInternalError");
    expect(area).toBe("Painel Master");
  });

  it("erro não tratado no site comercial (cadastro) dispara alerta com área 'Site comercial'", () => {
    alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("falha no signup") }, "public.signup");
    const [, , , area] = mocks.alertSystemError.mock.calls[0] as [string, string, string, string];
    expect(area).toContain("Site comercial");
  });

  it("endpoint fora do mapa conhecido cai no rótulo genérico, nunca fica sem área", () => {
    alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("falha em área nova") }, "algumNamespaceNovo.boom");
    const [, , , area] = mocks.alertSystemError.mock.calls[0] as [string, string, string, string];
    expect(area).toBe("saas-core (área desconhecida)");
  });

  it("erro de validação (Zod) NÃO dispara alerta — é entrada errada do usuário, não malfuncionamento", () => {
    const zodError = new ZodError([{ code: "custom", message: "Campo obrigatório", path: ["nome"] }]);
    const result = alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: zodError }, "public.signup");
    expect(result).toBe(false);
    expect(mocks.alertSystemError).not.toHaveBeenCalled();
  });

  it("TRPCError lançado de propósito (sem cause, ex.: UNAUTHORIZED) NÃO dispara alerta — erro de negócio esperado, não bug", () => {
    const trpcError = new TRPCError({ code: "UNAUTHORIZED", message: "Chave de API inválida." });
    const result = alertOnUnintentionalInternalError({ code: trpcError.code, cause: trpcError.cause }, "restaurants.get");
    expect(result).toBe(false);
    expect(mocks.alertSystemError).not.toHaveBeenCalled();
  });
});

describe("describeArea", () => {
  it("mapeia os principais namespaces da plataforma pra rótulos legíveis", () => {
    expect(describeArea("masterPanel.dashboard.getSummary")).toBe("Painel Master");
    expect(describeArea("public.signup")).toContain("Site comercial");
    expect(describeArea("sync.mySnapshot")).toContain("Sincronização");
    expect(describeArea("restaurants.create")).toContain("API interna");
    expect(describeArea("support.startSupportSession")).toBe("Modo Suporte");
  });

  it("namespace desconhecido ou path ausente caem no rótulo genérico", () => {
    expect(describeArea("algoNuncaVisto.x")).toBe("saas-core (área desconhecida)");
    expect(describeArea(undefined)).toBe("saas-core (área desconhecida)");
  });
});
