import { describe, expect, it } from "vitest";
import { ALLOWED_STATUS_TRANSITIONS, calculateCartTotal, normalizePhone } from "../shared/orderDomain";

describe("regras de pedidos", () => {
  it("normaliza telefones brasileiros removendo pontuação e código 55", () => {
    expect(normalizePhone("+55 (85) 99999-1234")).toBe("85999991234");
    expect(normalizePhone("(85) 3333-2222")).toBe("8533332222");
  });

  it("calcula subtotal, taxa e total sem arredondamentos monetários indevidos", () => {
    expect(calculateCartTotal([
      { unitPriceCents: 1500, quantity: 2 },
      { unitPriceCents: 700, quantity: 1 },
    ], 700)).toEqual({ subtotalCents: 3700, deliveryFeeCents: 700, totalCents: 4400 });
  });

  it("permite os caminhos operacionais previstos e bloqueia reversões", () => {
    expect(ALLOWED_STATUS_TRANSITIONS.PENDING).toContain("ACCEPTED");
    expect(ALLOWED_STATUS_TRANSITIONS.PREPARING).toContain("READY_FOR_PICKUP");
    expect(ALLOWED_STATUS_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(ALLOWED_STATUS_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});
