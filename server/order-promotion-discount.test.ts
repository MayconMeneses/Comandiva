import { describe, expect, it } from "vitest";
import { computeComboDiscountCents, type ComboDefinition } from "./routers/order";

/**
 * `computeComboDiscountCents` é o núcleo do desconto de combo (promoção com
 * mais de um produto vinculado) — decide sozinho, a partir das quantidades
 * reais do carrinho, se um ou mais combos se formam. Nunca confia em nada
 * que o cliente diga sobre "qual promoção" ele quis usar.
 */
function combo(overrides: Partial<ComboDefinition> & Pick<ComboDefinition, "promotionId" | "promoPriceCents" | "productIds">): ComboDefinition {
  const productPriceCentsById = overrides.productPriceCentsById ?? Object.fromEntries(overrides.productIds.map(id => [id, 1000]));
  return { productPriceCentsById, ...overrides };
}

describe("computeComboDiscountCents", () => {
  it("aplica o desconto quando o carrinho tem exatamente os produtos do combo", () => {
    const burger = combo({ promotionId: 1, promoPriceCents: 1500, productIds: [1, 2], productPriceCentsById: { 1: 1000, 2: 1000 } });
    expect(computeComboDiscountCents({ 1: 1, 2: 1 }, [burger])).toBe(500); // 2000 - 1500
  });

  it("multiplica o desconto quando o carrinho fecha o combo mais de uma vez", () => {
    const burger = combo({ promotionId: 1, promoPriceCents: 1500, productIds: [1, 2], productPriceCentsById: { 1: 1000, 2: 1000 } });
    expect(computeComboDiscountCents({ 1: 2, 2: 2 }, [burger])).toBe(1000); // 2 combos completos
  });

  it("não desconta nada se falta um produto do combo no carrinho", () => {
    const burger = combo({ promotionId: 1, promoPriceCents: 1500, productIds: [1, 2] });
    expect(computeComboDiscountCents({ 1: 1 }, [burger])).toBe(0);
  });

  it("desconta só o número de combos que fecham, ignorando o excedente de um produto", () => {
    const burger = combo({ promotionId: 1, promoPriceCents: 1500, productIds: [1, 2], productPriceCentsById: { 1: 1000, 2: 1000 } });
    // 3 unidades do produto 1, só 1 do produto 2 → só 1 combo fecha
    expect(computeComboDiscountCents({ 1: 3, 2: 1 }, [burger])).toBe(500);
  });

  it("nunca gera desconto negativo se a promoção foi cadastrada com preço promocional maior que a soma", () => {
    const misconfigured = combo({ promotionId: 1, promoPriceCents: 5000, productIds: [1, 2], productPriceCentsById: { 1: 1000, 2: 1000 } });
    expect(computeComboDiscountCents({ 1: 1, 2: 1 }, [misconfigured])).toBe(0);
  });

  it("quando dois combos disputam o mesmo produto, aplica o de maior desconto primeiro e não conta o produto duas vezes", () => {
    // Combo A: produtos 1+2 por 1500 (desconto 500). Combo B: produtos 1+3 por 1000 (desconto 1000, melhor).
    const comboA = combo({ promotionId: 1, promoPriceCents: 1500, productIds: [1, 2], productPriceCentsById: { 1: 1000, 2: 1000 } });
    const comboB = combo({ promotionId: 2, promoPriceCents: 1000, productIds: [1, 3], productPriceCentsById: { 1: 1000, 3: 1000 } });
    // Só 1 unidade do produto 1 existe — não pode fechar os dois combos ao mesmo tempo.
    const discount = computeComboDiscountCents({ 1: 1, 2: 1, 3: 1 }, [comboA, comboB]);
    expect(discount).toBe(1000); // combo B (melhor desconto) consome o produto 1; combo A fica sem produto 1 disponível
  });

  it("promoção de produto único (sem combo) não é filtrada aqui — quem chama (priceOrder) que decide ignorá-la", () => {
    // A função em si não sabe/não precisa saber que "combo de 1 produto" não deveria existir;
    // esse filtro (productIds.length > 1) é responsabilidade de priceOrder, não daqui.
    const single = combo({ promotionId: 1, promoPriceCents: 500, productIds: [1], productPriceCentsById: { 1: 1000 } });
    expect(computeComboDiscountCents({ 1: 5 }, [single])).toBe(5 * (1000 - 500));
  });

  it("lista de combos vazia não desconta nada", () => {
    expect(computeComboDiscountCents({ 1: 5, 2: 5 }, [])).toBe(0);
  });
});
