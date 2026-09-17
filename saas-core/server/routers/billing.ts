import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSubscriptionForRestaurant, listBillingPaymentsForSubscription, reactivateScheduledCancellation, scheduleCancellation, startOrChangePlan } from "../db/subscriptions";
import { restaurantProcedure, router } from "../_core/trpc";

// Endpoint self-service real: autenticado pela API key do próprio
// deployment (restaurantProcedure), nunca pela sessão do Super Admin — é
// assim que "o cliente muda o próprio plano sem administrador" fica possível
// de verdade. O Painel Master (masterPanel/billing.ts) continua existindo
// separado, só pra visibilidade/supervisão (nunca ativação manual em
// condições normais).
export const billingRouter = router({
  changePlan: restaurantProcedure
    .input(z.object({ planKey: z.string().min(1), payerEmail: z.string().email(), backUrl: z.string().url(), deviceId: z.string().trim().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await startOrChangePlan({
          restaurantId: ctx.restaurant.id,
          planKey: input.planKey,
          payerEmail: input.payerEmail,
          backUrl: input.backUrl,
          actor: `restaurant:${ctx.restaurant.id}`,
          deviceId: input.deviceId,
        });
        return result;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível alterar o plano." });
      }
    }),

  cancelSubscription: restaurantProcedure.input(z.object({ reason: z.string().max(500).optional() })).mutation(async ({ input, ctx }) => {
    try {
      return await scheduleCancellation({ restaurantId: ctx.restaurant.id, reason: input.reason, actor: `restaurant:${ctx.restaurant.id}` });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cancelar a assinatura." });
    }
  }),

  reactivateSubscription: restaurantProcedure.mutation(async ({ ctx }) => {
    try {
      return await reactivateScheduledCancellation({ restaurantId: ctx.restaurant.id, actor: `restaurant:${ctx.restaurant.id}` });
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível reativar a assinatura." });
    }
  }),

  paymentHistory: restaurantProcedure.query(async ({ ctx }) => {
    const current = await getSubscriptionForRestaurant(ctx.restaurant.id);
    if (!current) return [];
    return listBillingPaymentsForSubscription(current.subscription.id);
  }),
});
