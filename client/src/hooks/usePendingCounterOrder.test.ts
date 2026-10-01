// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearPendingOrder, PENDING_ORDER_CHANGE_EVENT, persistPendingOrderDisplay } from "@/lib/pendingOrderQueue";
import { usePendingCounterOrder } from "./usePendingCounterOrder";

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
