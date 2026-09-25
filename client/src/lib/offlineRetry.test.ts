import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { isNetworkError, isRetryingOffline, offlineResilienceMutationOptions, orderMutationRetryDelay, shouldRetryOrderMutation } from "./offlineRetry";

// Constrói os dois formatos REAIS que TRPCClientError.from produz (confirmado
// lendo node_modules/@trpc/client/dist/TRPCClientError-*.mjs): quando a causa
// é uma resposta JSON-RPC de erro válida, `.data` vem populado a partir de
// `result.error.data`; quando a causa é um erro cru (fetch rejeitou, resposta
// não é JSON-RPC), `.data` fica undefined. Isso é o discriminador real que
// isNetworkError usa — não é uma suposição sobre o formato, é como a lib
// instalada realmente se comporta.
function businessError(code: string): TRPCClientError<never> {
  return TRPCClientError.from({ error: { code: -32600, message: "erro de negócio", data: { code, httpStatus: 400, path: "order.create" } } });
}
function transportError(cause: unknown = new TypeError("Failed to fetch")): TRPCClientError<never> {
  return TRPCClientError.from(cause);
}

describe("offlineRetry", () => {
  describe("isNetworkError", () => {
    it("erro de transporte (fetch rejeitou, nunca virou resposta JSON-RPC): true", () => {
      expect(isNetworkError(transportError())).toBe(true);
    });
    it("erro de negócio (servidor respondeu e recusou, data populado): false", () => {
      expect(isNetworkError(businessError("BAD_REQUEST"))).toBe(false);
      expect(isNetworkError(businessError("CONFLICT"))).toBe(false);
      expect(isNetworkError(businessError("TOO_MANY_REQUESTS"))).toBe(false);
    });
    it("AbortError (nós mesmos abortamos): false, nunca tenta de novo sozinho", () => {
      const abort = new DOMException("aborted", "AbortError");
      expect(isNetworkError(transportError(abort))).toBe(false);
    });
    it("erro que não é TRPCClientError: false", () => {
      expect(isNetworkError(new Error("qualquer coisa"))).toBe(false);
      expect(isNetworkError("string crua")).toBe(false);
      expect(isNetworkError(null)).toBe(false);
    });
  });

  describe("shouldRetryOrderMutation", () => {
    it("erro de rede: tenta até failureCount < 2", () => {
      expect(shouldRetryOrderMutation(0, transportError())).toBe(true);
      expect(shouldRetryOrderMutation(1, transportError())).toBe(true);
    });
    it("erro de rede: para de tentar a partir de failureCount >= 2", () => {
      expect(shouldRetryOrderMutation(2, transportError())).toBe(false);
      expect(shouldRetryOrderMutation(5, transportError())).toBe(false);
    });
    it("erro de negócio: nunca tenta de novo, nenhum failureCount", () => {
      expect(shouldRetryOrderMutation(0, businessError("BAD_REQUEST"))).toBe(false);
      expect(shouldRetryOrderMutation(1, businessError("BAD_REQUEST"))).toBe(false);
    });
  });

  describe("orderMutationRetryDelay", () => {
    it("backoff curto: 500ms na primeira, 1000ms na segunda", () => {
      expect(orderMutationRetryDelay(0)).toBe(500);
      expect(orderMutationRetryDelay(1)).toBe(1000);
    });
    it("capa em 2000ms mesmo pra failureCount maior", () => {
      expect(orderMutationRetryDelay(2)).toBe(2000);
      expect(orderMutationRetryDelay(10)).toBe(2000);
    });
  });

  describe("isRetryingOffline", () => {
    it("pausada (isPaused): true, independente de isPending/failureCount", () => {
      expect(isRetryingOffline({ isPaused: true, isPending: false, failureCount: 0 })).toBe(true);
      expect(isRetryingOffline({ isPaused: true, isPending: true, failureCount: 3 })).toBe(true);
    });
    it("pendente com falha anterior (retry em backoff): true", () => {
      expect(isRetryingOffline({ isPaused: false, isPending: true, failureCount: 1 })).toBe(true);
    });
    it("primeira tentativa, ainda sem falha: false (é só \"enviando\", não \"tentando de novo\")", () => {
      expect(isRetryingOffline({ isPaused: false, isPending: true, failureCount: 0 })).toBe(false);
    });
    it("ocioso (nem pausada nem pendente): false", () => {
      expect(isRetryingOffline({ isPaused: false, isPending: false, failureCount: 0 })).toBe(false);
    });
  });

  describe("offlineResilienceMutationOptions (offline_resilience é recurso de plano)", () => {
    it("habilitado: devolve retry/retryDelay de verdade (os mesmos helpers)", () => {
      const options = offlineResilienceMutationOptions(true);
      expect(options).toEqual({ retry: shouldRetryOrderMutation, retryDelay: orderMutationRetryDelay });
    });
    it("desabilitado: força networkMode 'always' — sem isso, a pausa nativa do React Query (networkMode:'online' padrão) ainda daria o benefício de graça", () => {
      const options = offlineResilienceMutationOptions(false);
      expect(options).toEqual({ networkMode: "always" });
      expect(options).not.toHaveProperty("retry");
    });
  });
});
