import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { mutationErrorMessage } from "./mutationErrorMessage";

// Mesmas fixtures de offlineRetry.test.ts — formatos REAIS que
// TRPCClientError.from produz pra erro de transporte vs. erro de negócio.
function businessError(code: string): TRPCClientError<never> {
  return TRPCClientError.from({ error: { code: -32600, message: "Não é possível alterar de X para Y.", data: { code, httpStatus: 400, path: "order.create" } } });
}
function transportError(): TRPCClientError<never> {
  return TRPCClientError.from(new TypeError("Failed to fetch"));
}

describe("mutationErrorMessage", () => {
  it("sem erro: null", () => {
    expect(mutationErrorMessage(null)).toBeNull();
    expect(mutationErrorMessage(undefined)).toBeNull();
  });

  it("erro de rede (transporte): mensagem tranquilizadora, não o texto cru do fetch — regressão real: equipe lia \"Failed to fetch\" como \"não dá pra fazer o pedido\" testando o balcão offline", () => {
    const message = mutationErrorMessage(transportError());
    expect(message).toContain("Sem conexão");
    expect(message).not.toContain("Failed to fetch");
  });

  it("erro de negócio (servidor respondeu e recusou): mensagem real do servidor, sem alteração", () => {
    expect(mutationErrorMessage(businessError("BAD_REQUEST"))).toBe("Não é possível alterar de X para Y.");
  });

  it("Error comum (não TRPCClientError): usa error.message direto", () => {
    expect(mutationErrorMessage(new Error("algo quebrou"))).toBe("algo quebrou");
  });

  it("valor que não é Error nem TRPCClientError: converte pra string sem lançar", () => {
    expect(mutationErrorMessage("string crua")).toBe("string crua");
  });
});
