import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import { resolveOperationalSnapshotState } from "./useOperationalSnapshot";
import type { OperationalSnapshot } from "@/lib/operationalSnapshotCache";

// Mesmos dois formatos reais de TRPCClientError.from já usados em
// offlineRetry.test.ts (erro de transporte vs. erro de negócio).
function transportError(): TRPCClientError<never> {
  return TRPCClientError.from(new TypeError("Failed to fetch"));
}
function businessError(code: string): TRPCClientError<never> {
  return TRPCClientError.from({ error: { code: -32600, message: "erro de negócio", data: { code, httpStatus: 400, path: "admin.operationalSnapshot" } } });
}

const SNAPSHOT: OperationalSnapshot = { orders: [], tables: [], pendingServiceRequests: [] };
const refetch = vi.fn();

describe("resolveOperationalSnapshotState", () => {
  it("online, sem erro: usa o dado da query direto, isOffline false", () => {
    const result = resolveOperationalSnapshotState({ data: SNAPSHOT, error: undefined, isLoading: false, isFetching: false, refetch }, null);
    expect(result).toEqual({ data: SNAPSHOT, isLoading: false, isOffline: false, cachedAt: undefined, error: undefined, isFetching: false, refetch });
  });

  it("erro de rede, com cache válido salvo: isOffline true, devolve o snapshot cacheado + cachedAt", () => {
    const cached = { snapshot: SNAPSHOT, savedAt: 12345 };
    const result = resolveOperationalSnapshotState({ data: undefined, error: transportError(), isLoading: false, isFetching: false, refetch }, cached);
    expect(result.isOffline).toBe(true);
    expect(result.data).toBe(SNAPSHOT);
    expect(result.cachedAt).toBe(12345);
    expect(result.error).toBeUndefined();
  });

  it("erro de rede, sem cache (nunca carregou antes): isOffline true, data/cachedAt undefined", () => {
    const result = resolveOperationalSnapshotState({ data: undefined, error: transportError(), isLoading: false, isFetching: false, refetch }, null);
    expect(result.isOffline).toBe(true);
    expect(result.data).toBeUndefined();
    expect(result.cachedAt).toBeUndefined();
  });

  it("erro de negócio real (licença, validação): NÃO vira isOffline — cai em error, mesmo com cache disponível", () => {
    const cached = { snapshot: SNAPSHOT, savedAt: 12345 };
    const error = businessError("FORBIDDEN");
    const result = resolveOperationalSnapshotState({ data: undefined, error, isLoading: false, isFetching: false, refetch }, cached);
    expect(result.isOffline).toBe(false);
    expect(result.error).toBe(error);
    expect(result.data).toBeUndefined();
  });

  it("isFetching/refetch sempre vêm da query real, mesmo offline — botão \"Atualizar\" continua funcional", () => {
    const result = resolveOperationalSnapshotState({ data: undefined, error: transportError(), isLoading: false, isFetching: true, refetch }, null);
    expect(result.isFetching).toBe(true);
    expect(result.refetch).toBe(refetch);
  });
});
