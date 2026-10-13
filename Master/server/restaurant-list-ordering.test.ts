import { describe, expect, it } from "vitest";
import { restaurantSortPriority } from "./db/restaurants";

describe("restaurantSortPriority — ordem ativos, pagamentos atrasados, cancelados", () => {
  it("restaurante ativo com assinatura saudável vem primeiro (prioridade 0)", () => {
    expect(restaurantSortPriority({ status: "active" }, { status: "active" })).toBe(0);
    expect(restaurantSortPriority({ status: "active" }, { status: "trial" })).toBe(0);
  });

  it("assinatura com pagamento em atraso vem no meio (prioridade 1), mesmo com restaurante ainda 'active'", () => {
    expect(restaurantSortPriority({ status: "active" }, { status: "past_due" })).toBe(1);
    expect(restaurantSortPriority({ status: "active" }, { status: "payment_pending" })).toBe(1);
    expect(restaurantSortPriority({ status: "active" }, { status: "cancel_at_period_end" })).toBe(1);
  });

  it("restaurante suspenso vem no meio (prioridade 1), mesmo com assinatura ok", () => {
    expect(restaurantSortPriority({ status: "suspended" }, { status: "active" })).toBe(1);
  });

  it("restaurante cancelado sempre vai por último (prioridade 2), mesmo que a assinatura ainda esteja 'active'", () => {
    expect(restaurantSortPriority({ status: "cancelled" }, { status: "active" })).toBe(2);
    expect(restaurantSortPriority({ status: "cancelled" }, { status: "past_due" })).toBe(2);
  });

  it("ordenar uma lista mista pela prioridade produz ativos, depois atrasados, depois cancelados", () => {
    const rows = [
      { name: "Cancelado", status: "cancelled" as const, subscription: { status: "active" } },
      { name: "Ativo", status: "active" as const, subscription: { status: "active" } },
      { name: "Atrasado", status: "active" as const, subscription: { status: "past_due" } },
    ];
    const sorted = [...rows].sort((a, b) => restaurantSortPriority(a, a.subscription) - restaurantSortPriority(b, b.subscription));
    expect(sorted.map(r => r.name)).toEqual(["Ativo", "Atrasado", "Cancelado"]);
  });
});
