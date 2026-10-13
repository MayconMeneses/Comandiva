import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";
import { resolveAuthState } from "./resolveAuthState";
import type { AuthUser } from "./authSessionCache";

// Mesmos dois formatos reais de TRPCClientError.from já usados em
// offlineRetry.test.ts/useOperationalSnapshot.test.ts (erro de transporte vs.
// erro de negócio).
function transportError(): TRPCClientError<never> {
  return TRPCClientError.from(new TypeError("Failed to fetch"));
}
function businessError(code: string): TRPCClientError<never> {
  return TRPCClientError.from({ error: { code: -32600, message: "erro de negócio", data: { code, httpStatus: 400, path: "auth.me" } } });
}

const USER = { id: 1, role: "staff", name: "Equipe", email: "equipe@mm.local", permissions: [] } as unknown as AuthUser;

describe("resolveAuthState", () => {
  it("online, sem erro: usa o dado da query direto, isOffline false", () => {
    const result = resolveAuthState({ data: USER, error: undefined, isLoading: false }, null);
    expect(result).toEqual({ user: USER, loading: false, isOffline: false, error: undefined });
  });

  it("erro de rede, com cache válido salvo: isOffline true, devolve o usuário cacheado", () => {
    const cached = { user: USER, savedAt: 12345 };
    const result = resolveAuthState({ data: undefined, error: transportError(), isLoading: false }, cached);
    expect(result.isOffline).toBe(true);
    expect(result.user).toBe(USER);
    expect(result.loading).toBe(false);
    expect(result.error).toBeNull();
  });

  it("erro de rede, cache ainda não checado (undefined): continua carregando, não pisca login", () => {
    const result = resolveAuthState({ data: undefined, error: transportError(), isLoading: false }, undefined);
    expect(result.loading).toBe(true);
    expect(result.user).toBeNull();
    expect(result.isOffline).toBe(false);
  });

  it("erro de rede, cache checado e vazio (null — nunca logou neste aparelho, ou passou das 24h): sem sessão, sem loading infinito", () => {
    const result = resolveAuthState({ data: undefined, error: transportError(), isLoading: false }, null);
    expect(result.loading).toBe(false);
    expect(result.user).toBeNull();
    expect(result.isOffline).toBe(false);
  });

  it("erro de negócio real (ex.: sessão expirada de verdade): NÃO vira isOffline, mesmo com cache disponível", () => {
    const cached = { user: USER, savedAt: 12345 };
    const error = businessError("UNAUTHORIZED");
    const result = resolveAuthState({ data: undefined, error, isLoading: false }, cached);
    expect(result.isOffline).toBe(false);
    expect(result.error).toBe(error);
    expect(result.user).toBeNull();
  });

  it("carregando pela 1ª vez (sem erro ainda): loading normal da query, sem mexer no cache", () => {
    const result = resolveAuthState({ data: undefined, error: undefined, isLoading: true }, undefined);
    expect(result.loading).toBe(true);
    expect(result.isOffline).toBe(false);
  });
});
