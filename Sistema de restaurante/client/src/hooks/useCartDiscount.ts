import { useMemo } from "react";
import type { CartItem } from "@/contexts/CartContext";
import { computeCartDiscountCents } from "@/lib/localPriceCalculator";
import { trpc } from "@/lib/trpc";

const unitPriceOf = (item: CartItem) => item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0);

/**
 * Desconto de promoção sobre os itens da sacola, calculado no aparelho com as
 * promoções do cardápio (mesma conta do servidor). Serve pra sacola e o botão
 * "Adicionar" mostrarem o valor real; o total cobrado continua sendo o do
 * servidor (`order.preview`).
 */
export function useCartDiscount(items: CartItem[]) {
  const promotions = trpc.catalog.promotions.useQuery();
  const discountOf = useMemo(() => (list: CartItem[]) => promotions.data ? computeCartDiscountCents(list.map(item => ({ productId: item.productId, quantity: item.quantity, unitPriceCents: unitPriceOf(item) })), promotions.data) : 0, [promotions.data]);
  return { discountCents: useMemo(() => discountOf(items), [discountOf, items]), discountOf };
}
