import { z } from "zod";
import { getActiveEvents, getActiveFaqItems, getActivePromotions, getCatalog, getDeliveryRoutes, getProductDetail, getStoreSettingsCached } from "../db";
import { getLicenseSnapshot } from "../_core/license";
import { publicProcedure, router } from "../_core/trpc";

export const catalogRouter = router({
  // Composto aqui (não em getStoreSettingsCached, que é DB puro) — offline_resilience
  // é recurso de plano (Profissional+), checado numa query PÚBLICA porque as telas que
  // precisam saber disso (Checkout.tsx/TableSession.tsx) não têm login. Seguro expor: a
  // licença é do deployment inteiro (1 restaurante = 1 container isolado), nunca
  // multi-tenant — mesmo raciocínio já usado em table.resolve pra "tables_qr".
  settings: publicProcedure.query(async () => {
    const [settings, license] = await Promise.all([getStoreSettingsCached(), getLicenseSnapshot()]);
    return { ...settings, offlineResilienceEnabled: license.features.includes("offline_resilience") };
  }),
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
