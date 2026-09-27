// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado de revisão de código: as 3 telas usavam
 * `useRef(offlineResilienceEnabled ? resumeOrCreateOperationId(...) : generateClientId())`
 * — o inicializador do useRef só roda na 1ª renderização, e
 * offlineResilienceEnabled sempre chega `undefined`/`false` nesse momento
 * (depende de uma query assíncrona que ainda não respondeu). Na prática, o
 * ramo `resumeOrCreateOperationId` nunca rodava. Este hook corrige isso:
 * troca pelo id retomado assim que o valor de verdade é conhecido.
 */
const mocks = vi.hoisted(() => ({ resumeOrCreateOperationId: vi.fn() }));
vi.mock("@/lib/pendingOrderQueue", () => ({ resumeOrCreateOperationId: mocks.resumeOrCreateOperationId }));

import { useResumableOperationId } from "./useResumableOperationId";

const CONTEXT = { type: "order.create" as const, screen: "checkout" as const };

describe("useResumableOperationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resumeOrCreateOperationId.mockReturnValue("id-retomado-da-fila-pendente");
  });

  it("nunca começa nulo/vazio, mesmo antes de saber se offline resilience está ligado", () => {
    const { result } = renderHook(({ enabled }) => useResumableOperationId(CONTEXT, enabled), { initialProps: { enabled: undefined as boolean | undefined } });
    expect(typeof result.current.current).toBe("string");
    expect(result.current.current.length).toBeGreaterThan(0);
    expect(mocks.resumeOrCreateOperationId).not.toHaveBeenCalled();
  });

  it("quando offlineResilienceEnabled passa de desconhecido pra true, troca pelo id retomado (a correção do achado)", () => {
    const { result, rerender } = renderHook(({ enabled }) => useResumableOperationId(CONTEXT, enabled), { initialProps: { enabled: undefined as boolean | undefined } });
    const idDescartavel = result.current.current;

    // Simula catalog.settings respondendo (a query resolve, offlineResilienceEnabled é true de verdade).
    rerender({ enabled: true });

    expect(result.current.current).toBe("id-retomado-da-fila-pendente");
    expect(result.current.current).not.toBe(idDescartavel);
    expect(mocks.resumeOrCreateOperationId).toHaveBeenCalledWith(CONTEXT);
  });

  it("quando offlineResilienceEnabled passa de desconhecido pra false, mantém o id descartável (não chama resumeOrCreateOperationId)", () => {
    const { result, rerender } = renderHook(({ enabled }) => useResumableOperationId(CONTEXT, enabled), { initialProps: { enabled: undefined as boolean | undefined } });
    const idOriginal = result.current.current;

    rerender({ enabled: false });

    expect(result.current.current).toBe(idOriginal);
    expect(mocks.resumeOrCreateOperationId).not.toHaveBeenCalled();
  });

  it("só troca uma vez: uma mudança de valor DEPOIS de já resolvido não troca o id de novo", () => {
    const { result, rerender } = renderHook(({ enabled }) => useResumableOperationId(CONTEXT, enabled), { initialProps: { enabled: undefined as boolean | undefined } });

    rerender({ enabled: true });
    expect(result.current.current).toBe("id-retomado-da-fila-pendente");

    mocks.resumeOrCreateOperationId.mockReturnValue("outro-id-que-nunca-deveria-aparecer");
    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current.current).toBe("id-retomado-da-fila-pendente");
    expect(mocks.resumeOrCreateOperationId).toHaveBeenCalledTimes(1);
  });
});
