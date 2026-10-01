import { calculateCartTotal } from "../../../shared/orderDomain";

/**
 * Fase 1 do offline-first do painel admin (ver plano em
 * C:\Users\maico\.claude\plans\lovely-purring-dusk.md): estimativa de preço
 * pro carrinho do Checkout quando `trpc.order.preview` falha por queda de
 * rede. Calcula em cima do que já está cacheado localmente (o item do
 * carrinho já vem com preço unitário validado contra o catálogo no momento
 * em que foi adicionado; o que falta pra bater com `priceOrder` no servidor
 * é só o desconto de combo + a soma final).
 */

export type ComboDefinition = { promotionId: number; promoPriceCents: number; productIds: number[]; productPriceCentsById: Record<number, number> };

/**
 * MESMA lógica de `computeComboDiscountCents` em `server/routers/order.ts` —
 * duplicada de propósito (não movida pra `shared/`): é uma função de ~15
 * linhas, sem toque de banco, e mover ela criaria uma dependência cruzada
 * artificial só por conveniência. O teste de paridade em
 * `localPriceCalculator.test.ts` roda as duas versões contra os mesmos casos
 * e garante que não divirjam silenciosamente — mude as duas juntas.
 */
export function computeComboDiscountCents(cartQuantityByProductId: Record<number, number>, combos: ComboDefinition[]): number {
  const remaining = { ...cartQuantityByProductId };
  const withDiscount = combos
    .map(combo => ({ combo, regularSum: combo.productIds.reduce((sum, id) => sum + (combo.productPriceCentsById[id] ?? 0), 0) }))
    .map(({ combo, regularSum }) => ({ combo, perBundleDiscount: regularSum - combo.promoPriceCents }))
    .filter(({ perBundleDiscount }) => perBundleDiscount > 0)
    .sort((a, b) => b.perBundleDiscount - a.perBundleDiscount);

  let discount = 0;
  for (const { combo, perBundleDiscount } of withDiscount) {
    if (!combo.productIds.length) continue;
    const multiplier = Math.min(...combo.productIds.map(id => remaining[id] ?? 0));
    if (multiplier <= 0) continue;
    discount += multiplier * perBundleDiscount;
    for (const id of combo.productIds) remaining[id] = (remaining[id] ?? 0) - multiplier;
  }
  return discount;
}

export type LocalPriceCalcInput = {
  items: Array<{ productId: number; quantity: number; unitPriceCents: number }>;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  // Mesmo formato de `trpc.catalog.promotions` — só os campos usados aqui.
  promotions: Array<{ id: number; promoPriceCents: number | null; products: Array<{ id: number; priceCents: number }> }>;
};

export type LocalPriceCalcResult =
  | { ok: true; subtotalCents: number; deliveryFeeCents: number; totalCents: number; discountCents: number }
  | { ok: false; message: string };

export function calculateLocalPrice(input: LocalPriceCalcInput): LocalPriceCalcResult {
  const rawTotals = calculateCartTotal(input.items, input.deliveryFeeCents);

  // Combo = promoção com mais de um produto vinculado (mesmo filtro de
  // `server/routers/order.ts:178` — promoção de 1 produto só destaca, não desconta).
  const combos: ComboDefinition[] = input.promotions
    .filter((promotion): promotion is typeof promotion & { promoPriceCents: number } => promotion.promoPriceCents != null && promotion.products.length > 1)
    .map(promotion => ({
      promotionId: promotion.id,
      promoPriceCents: promotion.promoPriceCents,
      productIds: promotion.products.map(product => product.id),
      productPriceCentsById: Object.fromEntries(promotion.products.map(product => [product.id, product.priceCents])),
    }));

  const cartQuantityByProductId: Record<number, number> = {};
  for (const item of input.items) cartQuantityByProductId[item.productId] = (cartQuantityByProductId[item.productId] ?? 0) + item.quantity;

  const discountCents = Math.min(computeComboDiscountCents(cartQuantityByProductId, combos), rawTotals.subtotalCents);
  const subtotalCents = rawTotals.subtotalCents - discountCents;
  const totalCents = rawTotals.totalCents - discountCents;

  if (subtotalCents < input.minimumOrderCents) {
    return { ok: false, message: "O pedido está abaixo do mínimo." };
  }
  return { ok: true, subtotalCents, deliveryFeeCents: rawTotals.deliveryFeeCents, totalCents, discountCents };
}
