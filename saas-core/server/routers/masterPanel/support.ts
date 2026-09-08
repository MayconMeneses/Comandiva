import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getRestaurantById } from "../../db/restaurants";
import { createSupportSession } from "../../db/supportSessions";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

export const masterPanelSupportRouter = router({
  start: platformAdminProcedureFor("modo_suporte").input(z.object({ restaurantId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const restaurant = await getRestaurantById(input.restaurantId);
    if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
    if (restaurant.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Este restaurante está suspenso/cancelado — não é possível entrar em modo suporte." });
    }
    if (!restaurant.deploymentUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Configure a URL de deployment deste restaurante antes de usar o Modo Suporte." });
    }

    const { token, expiresAt } = await createSupportSession({
      restaurantId: restaurant.id,
      platformAdminId: ctx.platformAdmin.id,
      issuedFromIp: ctx.req.ip,
    });
    const base = restaurant.deploymentUrl.replace(/\/+$/, "");
    return { entryUrl: `${base}/suporte/entrar?token=${encodeURIComponent(token)}`, expiresAt };
  }),
});
