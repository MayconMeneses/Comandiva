import { z } from "zod";
import { getActiveEvents, getActiveFaqItems, getActivePromotions, getCatalog, getDeliveryRoutes, getProductDetail, getStoreSettingsCached } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  settings: publicProcedure.query(async () => getStoreSettingsCached()),
  deliveryRoutes: publicProcedure.query(async () => getDeliveryRoutes(true)),
  list: publicProcedure.query(async () => getCatalog()),
  promotions: publicProcedure.query(async () => getActivePromotions()),
  events: publicProcedure.query(async () => getActiveEvents()),
  faqItems: publicProcedure.query(async () => getActiveFaqItems()),
  product: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ input }) => {
    const product = await getProductDetail(input.productId);
    if (!product) throw new Error("Produto não encontrado");
    return product;
  }),
});
