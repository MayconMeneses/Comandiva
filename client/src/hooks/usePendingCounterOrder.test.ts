// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingOrder, PENDING_ORDER_CHANGE_EVENT, persistPendingOrderDisplay, type PendingRoundDisplaySnapshot } from "@/lib/pendingOrderQueue";
import { usePendingCounterOrder, usePendingDisplaySnapshot } from "./usePendingCounterOrder";

const COUNTER_CONTEXT = { type: "order.create" as const, screen: "counter" as const };
const display = { customerName: "Ana", customerPhone: "85988887777", totalCents: 4500, items: [{ name: "X-Burguer", quantity: 2 }] };

// persistPendingOrderDisplay por si só não dispara o evento (ver
// pendingOrderQueue.ts) — na tela real (NewCounterOrder.tsx) ele é sempre
// chamado ANTES de persistPendingOrder, que é quem dispara. Aqui, sem a
// pendência de reenvio em si, disparamos o evento manualmente pra isolar só
// o comportamento do hook.
function notifyChange() {
  window.dispatchEvent(new CustomEvent(PENDING_ORDER_CHANGE_EVENT));
}

describe("usePendingCounterOrder", () => {
  beforeEach(() => localStorage.clear());

  it("sem pendência salva: null", () => {
    const { result } = renderHook(() => usePendingCounterOrder());
    expect(result.current).toBeNull();
  });

  it("reage a uma mudança feita FORA do componente (evento customizado, não é polling)", () => {
    const { result } = renderHook(() => usePendingCounterOrder());
    expect(result.current).toBeNull();
    act(() => {
      persistPendingOrderDisplay(COUNTER_CONTEXT, display);
      notifyChange();
    });
    expect(result.current).toEqual(display);
  });

  it("reage a clearPendingOrder — volta pra null quando o pedido de verdade confirma", () => {
    persistPendingOrderDisplay(COUNTER_CONTEXT, display);
    const { result } = renderHook(() => usePendingCounterOrder());
    expect(result.current).toEqual(display);
    act(() => clearPendingOrder(COUNTER_CONTEXT));
    expect(result.current).toBeNull();
  });
});

// Frente 1 da Fase 2b (ver C:\Users\maico\.claude\plans\lovely-purring-dusk.md):
// usePendingCounterOrder acima é agora um wrapper fino em cima deste hook
// genérico — cobre o caso novo (rodada de mesa) e, junto com a describe
// acima (que continua passando sem alteração), confirma que generalizar não
// quebrou o comportamento existente.
describe("usePendingDisplaySnapshot (genérico)", () => {
  const ROUND_CONTEXT = { type: "table.addRound" as const, token: "mesa-7" };
  const roundDisplay: PendingRoundDisplaySnapshot = { tableLabel: "Mesa 7", totalCents: 3200, items: [{ name: "Água", quantity: 2 }] };

  beforeEach(() => localStorage.clear());

  it("sem pendência salva: null", () => {
    const { result } = renderHook(() => usePendingDisplaySnapshot<PendingRoundDisplaySnapshot>(ROUND_CONTEXT));
    expect(result.current).toBeNull();
  });

  it("reage a uma mudança feita FORA do componente (evento customizado, não é polling)", () => {
    const { result } = renderHook(() => usePendingDisplaySnapshot<PendingRoundDisplaySnapshot>(ROUND_CONTEXT));
    expect(result.current).toBeNull();
    act(() => {
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>(ROUND_CONTEXT, roundDisplay);
      window.dispatchEvent(new CustomEvent(PENDING_ORDER_CHANGE_EVENT));
    });
    expect(result.current).toEqual(roundDisplay);
  });

  it("reage a clearPendingOrder — volta pra null quando a rodada de verdade confirma", () => {
    persistPendingOrderDisplay<PendingRoundDisplaySnapshot>(ROUND_CONTEXT, roundDisplay);
    const { result } = renderHook(() => usePendingDisplaySnapshot<PendingRoundDisplaySnapshot>(ROUND_CONTEXT));
    expect(result.current).toEqual(roundDisplay);
    act(() => clearPendingOrder(ROUND_CONTEXT));
    expect(result.current).toBeNull();
  });

  it("duas instâncias do hook com contextos diferentes não cruzam cache entre si (cache por instância, não mais módulo-global)", () => {
    const counterDisplay = display;
    persistPendingOrderDisplay(COUNTER_CONTEXT, counterDisplay);
    persistPendingOrderDisplay<PendingRoundDisplaySnapshot>(ROUND_CONTEXT, roundDisplay);
    const counterHook = renderHook(() => usePendingDisplaySnapshot(COUNTER_CONTEXT));
    const roundHook = renderHook(() => usePendingDisplaySnapshot<PendingRoundDisplaySnapshot>(ROUND_CONTEXT));
    expect(counterHook.result.current).toEqual(counterDisplay);
    expect(roundHook.result.current).toEqual(roundDisplay);
  });
});
