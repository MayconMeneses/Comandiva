import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, clearRateLimit, incrementCounter, refundRateLimit } from "./rateLimit";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("janela de 1 hora NÃO é apagada pela limpeza de 10 minutos (bug antigo)", () => {
    const options = { windowMs: 60 * 60 * 1000, maxAttempts: 2 };
    expect(checkRateLimit("rl-hora", options).allowed).toBe(true);
    expect(checkRateLimit("rl-hora", options).allowed).toBe(true);
    vi.advanceTimersByTime(30 * 60 * 1000); // passa por vários ciclos de limpeza
    expect(checkRateLimit("rl-hora", options).allowed).toBe(false);
    vi.advanceTimersByTime(31 * 60 * 1000);
    expect(checkRateLimit("rl-hora", options).allowed).toBe(true);
  });

  it("refund devolve uma tentativa e clear zera", () => {
    const options = { windowMs: 60_000, maxAttempts: 1 };
    expect(checkRateLimit("rl-refund", options).allowed).toBe(true);
    expect(checkRateLimit("rl-refund", options).allowed).toBe(false);
    refundRateLimit("rl-refund");
    expect(checkRateLimit("rl-refund", options).allowed).toBe(true);
    clearRateLimit("rl-refund");
    expect(checkRateLimit("rl-refund", options).allowed).toBe(true);
  });

  it("incrementCounter só conta, sem bloquear", () => {
    expect(incrementCounter("rl-count", 60_000)).toBe(1);
    expect(incrementCounter("rl-count", 60_000)).toBe(2);
    vi.advanceTimersByTime(61_000);
    expect(incrementCounter("rl-count", 60_000)).toBe(1);
  });
});
