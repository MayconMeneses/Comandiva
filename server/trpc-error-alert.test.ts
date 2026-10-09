import { TRPCError } from "@trpc/server";
import { ZodError } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prova que alertOnUnintentionalInternalError (server/_core/trpc.ts) — a
 * decisão usada dentro do errorFormatter real — dispara sendOwnerAlert
 * quando uma requisição quebra de um jeito inesperado (bug real, não erro de
 * validação nem TRPCError lançado de propósito), com a "área" certa
 * (derivada do namespace do endpoint) pra quem recebe o alerta ir direto no
 * problema.
 *
 * Chama a função extraída diretamente (não createCaller()/HTTP real) de
 * propósito: createCaller() NÃO passa pelo errorFormatter (só o adaptador
 * HTTP de verdade faz isso, ver comentário em trpc.ts) — simular uma
 * requisição HTTP completa só pra exercitar essa decisão seria testar o
 * roteamento do tRPC, não a lógica nova.
 */
const mocks = vi.hoisted(() => ({ sendOwnerAlert: vi.fn() }));
vi.mock("./_core/alerts", () => ({ sendOwnerAlert: mocks.sendOwnerAlert }));

const { alertOnUnintentionalInternalError, describeArea } = await import("./_core/trpc");

describe("alertOnUnintentionalInternalError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erro não tratado num endpoint de admin dispara alerta com área 'Painel administrativo'", () => {
    const cause = new Error("falha inesperada no admin");
    const result = alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause }, "admin.updateOrderStatus");

    expect(result).toBe(true);
    expect(mocks.sendOwnerAlert).toHaveBeenCalledTimes(1);
    const [subject, message, kind, severity, area] = mocks.sendOwnerAlert.mock.calls[0] as [string, string, string, unknown, string];
    expect(subject).toContain("admin.updateOrderStatus");
    expect(message).toBe(cause.stack);
    expect(kind).toBe("trpcInternalError");
    expect(severity).toBeUndefined();
    expect(area).toBe("Painel administrativo");
  });

  it("erro não tratado num endpoint de cardápio público dispara alerta com área 'Cardápio público'", () => {
    alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("falha no cardápio") }, "catalog.listAvailable");
    const [, , , , area] = mocks.sendOwnerAlert.mock.calls[0] as [string, string, string, unknown, string];
    expect(area).toBe("Cardápio público");
  });

  it("endpoint fora do mapa conhecido cai no rótulo genérico, nunca fica sem área", () => {
    alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("falha em área nova") }, "algumNamespaceNovo.boom");
    const [, , , , area] = mocks.sendOwnerAlert.mock.calls[0] as [string, string, string, unknown, string];
    expect(area).toBe("Comandiva (área desconhecida)");
  });

  it("endpoint desconhecido (path undefined) ainda dispara alerta, com rótulo genérico", () => {
    const result = alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: new Error("sem path") }, undefined);
    expect(result).toBe(true);
    const [subject, , , , area] = mocks.sendOwnerAlert.mock.calls[0] as [string, string, string, unknown, string];
    expect(subject).toContain("endpoint desconhecido");
    expect(area).toBe("Comandiva (área desconhecida)");
  });

  it("erro de validação (Zod) NÃO dispara alerta — é entrada errada do usuário, não malfuncionamento", () => {
    const zodError = new ZodError([{ code: "custom", message: "Nome é obrigatório", path: ["nome"] }]);
    const result = alertOnUnintentionalInternalError({ code: "INTERNAL_SERVER_ERROR", cause: zodError }, "admin.comInput");
    expect(result).toBe(false);
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
  });

  it("TRPCError lançado de propósito (sem cause, ex.: NOT_FOUND) NÃO dispara alerta — erro de negócio esperado, não bug", () => {
    const trpcError = new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const result = alertOnUnintentionalInternalError({ code: trpcError.code, cause: trpcError.cause }, "order.getByCode");
    expect(result).toBe(false);
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
  });

  it("código diferente de INTERNAL_SERVER_ERROR nunca dispara alerta, mesmo com uma cause de erro real", () => {
    const result = alertOnUnintentionalInternalError({ code: "BAD_REQUEST", cause: new Error("não deveria alertar") }, "admin.algo");
    expect(result).toBe(false);
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
  });
});

describe("describeArea", () => {
  it("mapeia os principais namespaces do app pra rótulos legíveis", () => {
    expect(describeArea("admin.updateOrderStatus")).toBe("Painel administrativo");
    expect(describeArea("catalog.list")).toBe("Cardápio público");
    expect(describeArea("order.create")).toBe("Pedido (checkout/acompanhamento)");
    expect(describeArea("table.getSession")).toBe("Mesas (QR Code + painel operacional)");
    expect(describeArea("support.startSession")).toBe("Modo Suporte");
  });

  it("namespace desconhecido ou path ausente caem no rótulo genérico", () => {
    expect(describeArea("algoNuncaVisto.x")).toBe("Comandiva (área desconhecida)");
    expect(describeArea(undefined)).toBe("Comandiva (área desconhecida)");
  });
});
