import { listPlansWithFeaturesAndLimitsCached } from "../db/plans";
import { computeSnapshotForRestaurant } from "../db/subscriptions";
import { restaurantProcedure, router } from "../_core/trpc";

/** O endpoint que cada deployment de restaurante realmente chama, periodicamente. */
export const syncRouter = router({
  mySnapshot: restaurantProcedure.query(({ ctx }) => computeSnapshotForRestaurant(ctx.restaurant.id)),
  // Catálogo público de planos (preço/features/limites de todos, não só o
  // atual) — usado pela tela "Meu Plano" de cada restaurante pra montar a
  // comparação. Mesma informação pra todo mundo, sem dado sensível.
  plans: restaurantProcedure.query(() => listPlansWithFeaturesAndLimitsCached()),
});
