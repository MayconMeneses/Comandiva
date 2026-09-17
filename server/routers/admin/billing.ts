import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cancelSubscription, changeSubscriptionPlan, getBillingPaymentHistory, reactivateSubscription } from "../../_core/billing";
import { adminOnlyProcedure, router } from "../../_core/trpc";

// adminOnlyProcedure (não adminProcedure) de propósito: trocar/cancelar a
// assinatura do restaurante com o SaaS é uma ação financeira tão sensível
// quanto Pix/gateway de pagamento — fora do Modo Suporte mesmo com escrita
// liberada no resto (mesmo raciocínio de paymentGateways.ts).
export const adminBillingRouter = router({
  changePlan: adminOnlyProcedure
    .input(z.object({ planKey: z.string().min(1), payerEmail: z.string().email().optional(), deviceId: z.string().trim().max(1000).optional() }))
    .mutation(async ({ input, ctx }) => {
      const payerEmail = input.payerEmail || ctx.user.email;
      if (!payerEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um e-mail para o pagamento — sua conta de admin não tem um cadastrado." });
      try {
        return await changeSubscriptionPlan(input.planKey, payerEmail, input.deviceId);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível alterar o plano." });
      }
    }),

  cancelSubscription: adminOnlyProcedure.input(z.object({ reason: z.string().max(500).optional() })).mutation(async ({ input }) => {
    try {
      return await cancelSubscription(input.reason);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cancelar a assinatura." });
    }
  }),

  reactivateSubscription: adminOnlyProcedure.mutation(async () => {
    try {
      return await reactivateSubscription();
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível reativar a assinatura." });
    }
  }),

  billingPaymentHistory: adminOnlyProcedure.query(async () => {
    try {
      return await getBillingPaymentHistory();
    } catch {
      return [];
    }
  }),
});
