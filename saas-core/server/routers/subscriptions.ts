import { z } from "zod";
import { planKeyValues, subscriptionStatusValues } from "../../drizzle/schema";
import { assignPlan, getSubscriptionForRestaurant, updateSubscriptionStatus } from "../db/subscriptions";
import { operatorProcedure, router } from "../_core/trpc";

export const subscriptionsRouter = router({
  get: operatorProcedure.input(z.object({ restaurantId: z.number().int().positive() })).query(({ input }) => getSubscriptionForRestaurant(input.restaurantId)),
  assign: operatorProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), planKey: z.enum(planKeyValues) }))
    .mutation(({ input }) => assignPlan(input)),
  updateStatus: operatorProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), status: z.enum(subscriptionStatusValues) }))
    .mutation(({ input }) => updateSubscriptionStatus(input)),
});
