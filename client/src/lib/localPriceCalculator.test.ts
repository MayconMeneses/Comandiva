import { describe, expect, it } from "vitest";
import { calculateLocalPrice, computeComboDiscountCents, type ComboDefinition } from "./localPriceCalculator";
import { computeComboDiscountCents as serverComputeComboDiscountCents } from "../../../server/routers/order";

const BURGER = { id: 1, quantity: 1, unitPriceCents: 2000 };
const FRIES = { id: 2, quantity: 1, unitPriceCents: 1000 };
const SODA = { id: 3, quantity: 1, unitPriceCents: 800 };

function item(product: { id: number; unitPriceCents: number }, quantity = 1) {
  return { productId: product.id, quantity, unitPriceCents: product.unitPriceCents };
}

describe("calculateLocalPrice — Fase 1 do offline-first (checkout)", () => {
  it("sem promoção: bate com soma simples + entrega, sem desconto", () => {
    const result = calculateLocalPrice({
      items: [item(BURGER), item(FRIES)],
      deliveryFeeCents: 700,
      minimumOrderCents: 0,
      promotions: [],
    });
    expect(result).toEqual({ ok: true, subtotalCents: 3000, deliveryFeeCents: 700, totalCents: 3700, discountCents: 0 });
  });

  it("combo ativo fechando exatamente: desconto aplicado no subtotal e no total", () => {
    const result = calculateLocalPrice({
      items: [item(BURGER), item(FRIES)],
      deliveryFeeCents: 700,
      minimumOrderCents: 0,
      promotions: [{ id: 1, promoPriceCents: 2500, products: [{ id: 1, priceCents: 2000 }, { id: 2, priceCents: 1000 }] }],
    });
    expect(result).toEqual({ ok: true, subtotalCents: 2500, deliveryFeeCents: 700, totalCents: 3200, discountCents: 500 });
  });

  it("combo parcialmente fechado (só 1 unidade de um dos 2 produtos): não desconta, falta o par", () => {
    const result = calculateLocalPrice({
      items: [item(BURGER)],
      deliveryFeeCents: 0,
      minimumOrderCents: 0,
      promotions: [{ id: 1, promoPriceCents: 2500, products: [{ id: 1, priceCents: 2000 }, { id: 2, priceCents: 1000 }] }],
    });
    expect(result).toEqual({ ok: true, subtotalCents: 2000, deliveryFeeCents: 0, totalCents: 2000, discountCents: 0 });
  });

  it("promoção de 1 produto só (sem combo de verdade): não desconta, mesmo filtro do servidor", () => {
    const result = calculateLocalPrice({
      items: [item(BURGER)],
      deliveryFeeCents: 0,
      minimumOrderCents: 0,
      promotions: [{ id: 1, promoPriceCents: 1500, products: [{ id: 1, priceCents: 2000 }] }],
    });
    expect(result.ok && result.discountCents).toBe(0);
  });

  it("abaixo do pedido mínimo: retorna erro, não um total", () => {
    const result = calculateLocalPrice({
      items: [item(SODA)],
      deliveryFeeCents: 0,
      minimumOrderCents: 5000,
      promotions: [],
    });
    expect(result).toEqual({ ok: false, message: "O pedido está abaixo do mínimo." });
  });

  it("2 combos disputando o mesmo produto: guloso, maior desconto primeiro (mesmo comportamento do servidor)", () => {
    const promotions = [
      { id: 1, promoPriceCents: 2700, products: [{ id: 1, priceCents: 2000 }, { id: 3, priceCents: 800 }] }, // desconto 100
      { id: 2, promoPriceCents: 2300, products: [{ id: 1, priceCents: 2000 }, { id: 2, priceCents: 1000 }] }, // desconto 700, ganha
    ];
    const result = calculateLocalPrice({
      items: [item(BURGER), item(FRIES), item(SODA)],
      deliveryFeeCents: 0,
      minimumOrderCents: 0,
      promotions,
    });
    // burguer some pro combo 2 (maior desconto) — sobra batata sem par e refri sem par, nenhum desconta sozinho
    expect(result).toEqual({ ok: true, subtotalCents: 3100, deliveryFeeCents: 0, totalCents: 3100, discountCents: 700 });
  });
});

describe("paridade: computeComboDiscountCents (cliente) === computeComboDiscountCents (servidor)", () => {
  const CASES: Array<{ name: string; quantities: Record<number, number>; combos: ComboDefinition[] }> = [
    { name: "sem combo", quantities: { 1: 2 }, combos: [] },
    { name: "1 combo fechando", quantities: { 1: 1, 2: 1 }, combos: [{ promotionId: 1, promoPriceCents: 2500, productIds: [1, 2], productPriceCentsById: { 1: 2000, 2: 1000 } }] },
    { name: "1 combo fechando 3×", quantities: { 1: 3, 2: 3 }, combos: [{ promotionId: 1, promoPriceCents: 2500, productIds: [1, 2], productPriceCentsById: { 1: 2000, 2: 1000 } }] },
    {
      name: "2 combos disputando produto, guloso",
      quantities: { 1: 1, 2: 1, 3: 1 },
      combos: [
        { promotionId: 1, promoPriceCents: 2700, productIds: [1, 3], productPriceCentsById: { 1: 2000, 3: 800 } },
        { promotionId: 2, promoPriceCents: 2300, productIds: [1, 2], productPriceCentsById: { 1: 2000, 2: 1000 } },
      ],
    },
    { name: "promoção mal cadastrada (preço promo maior que a soma): nunca desconta negativo", quantities: { 1: 1, 2: 1 }, combos: [{ promotionId: 1, promoPriceCents: 9999, productIds: [1, 2], productPriceCentsById: { 1: 2000, 2: 1000 } }] },
  ];

  it.each(CASES)("$name", ({ quantities, combos }) => {
    expect(computeComboDiscountCents(quantities, combos)).toBe(serverComputeComboDiscountCents(quantities, combos));
  });
});
