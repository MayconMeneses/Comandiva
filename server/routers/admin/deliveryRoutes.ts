import { z } from "zod";
import { deleteDeliveryRoute, getDeliveryRoutes, saveDeliveryRoute } from "../../db";
import { restaurantProcedureFor, router } from "../../_core/trpc";
import { optionalId, sortOrder } from "./shared";

export const adminDeliveryRoutesRouter = router({
  deliveryRoutes: restaurantProcedureFor("deliveryRoutes").query(() => getDeliveryRoutes()),
  saveDeliveryRoute: restaurantProcedureFor("deliveryRoutes").input(z.object({ id: optionalId, name: z.string().trim().min(2).max(120), coverageNotes: z.string().max(255).optional(), deliveryFeeCents: z.number().int().min(0).max(999999), estimatedDeliveryMin: z.number().int().min(1).max(240), estimatedDeliveryMax: z.number().int().min(1).max(360), active: z.boolean().default(true), sortOrder }).superRefine((value, context) => {
    if (value.estimatedDeliveryMin > value.estimatedDeliveryMax) context.addIssue({ code: "custom", path: ["estimatedDeliveryMin"], message: "O tempo mínimo deve ser menor ou igual ao máximo." });
  })).mutation(({ input }) => saveDeliveryRoute(input)),
  deleteDeliveryRoute: restaurantProcedureFor("deliveryRoutes").input(z.object({ routeId: z.number().int().positive() })).mutation(({ input }) => deleteDeliveryRoute(input.routeId)),
});
