import { z } from "zod";
import { restaurantStatusValues } from "../../drizzle/schema";
import { createRestaurantWithSubscription, listRestaurants, rotateApiKey, setRestaurantStatus } from "../db/restaurants";
import { operatorProcedure, router } from "../_core/trpc";
import { planKeyValues } from "../../drizzle/schema";

export const restaurantsRouter = router({
  create: operatorProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        planKey: z.enum(planKeyValues),
        contactName: z.string().trim().max(160).optional(),
        contactEmail: z.string().trim().email().optional(),
        contactPhone: z.string().trim().max(24).optional(),
      }),
    )
    .mutation(({ input }) => createRestaurantWithSubscription(input)),
  list: operatorProcedure.query(() => listRestaurants()),
  rotateApiKey: operatorProcedure.input(z.object({ restaurantId: z.number().int().positive() })).mutation(({ input }) => rotateApiKey(input.restaurantId)),
  setStatus: operatorProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), status: z.enum(restaurantStatusValues) }))
    .mutation(({ input }) => setRestaurantStatus(input.restaurantId, input.status)),
});
