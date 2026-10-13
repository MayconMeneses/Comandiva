// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_ORDER_WINDOW_MS } from "@/lib/pendingOrderQueue";
import { useStaleRetryWarning } from "./useStaleRetryWarning";

// O hook só reavalia a cada 15s (setInterval), não a cada milissegundo — um
// teste que avança só 1ms além do limiar cai exatamente EM CIMA do check
// mais próximo (que roda a `PENDING_ORDER_WINDOW_MS` exatos de diferença, já
// que o intervalo é múltiplo de 15s a partir do mount) e `> PENDING_ORDER_WINDOW_MS`
// (comparação estrita) ainda dá falso nesse instante exato; só o PRÓXIMO
// check, 15s depois, pegaria a mudança. Por isso os testes "logo depois do
// limite" avançam por mais de um período de verificação (16s), não só 1ms —
// isso reflete a granularidade real do hook, não frouxidão do teste.
const CHECK_INTERVAL_MS = 15_000;

describe("useStaleRetryWarning", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("false logo no início, mesmo ativo", () => {
    const { result } = renderHook(() => useStaleRetryWarning(true, Date.now()));
    expect(result.current).toBe(false);
  });

  it("vira true depois de passar PENDING_ORDER_WINDOW_MS, ainda ativo", () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useStaleRetryWarning(true, startedAt));
    act(() => { vi.advanceTimersByTime(PENDING_ORDER_WINDOW_MS + CHECK_INTERVAL_MS + 1000); });
    expect(result.current).toBe(true);
  });

  it("continua false pouco antes do limite", () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useStaleRetryWarning(true, startedAt));
    act(() => { vi.advanceTimersByTime(PENDING_ORDER_WINDOW_MS - 1000); });
    expect(result.current).toBe(false);
  });

  it("active:false nunca fica true, mesmo passando muito tempo", () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useStaleRetryWarning(false, startedAt));
    act(() => { vi.advanceTimersByTime(PENDING_ORDER_WINDOW_MS + 60_000); });
    expect(result.current).toBe(false);
  });

  it("startedAt: null nunca fica true", () => {
    const { result } = renderHook(() => useStaleRetryWarning(true, null));
    act(() => { vi.advanceTimersByTime(PENDING_ORDER_WINDOW_MS + 60_000); });
    expect(result.current).toBe(false);
  });

  it("voltando a active:false depois de já estar stale, volta pra false (não fica preso)", () => {
    const startedAt = Date.now();
    const { result, rerender } = renderHook(({ active, s }) => useStaleRetryWarning(active, s), { initialProps: { active: true, s: startedAt as number | null } });
    act(() => { vi.advanceTimersByTime(PENDING_ORDER_WINDOW_MS + CHECK_INTERVAL_MS + 1000); });
    expect(result.current).toBe(true);
    rerender({ active: false, s: null });
    expect(result.current).toBe(false);
  });
});
