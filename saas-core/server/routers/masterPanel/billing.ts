import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getRestaurantById } from "../../db/restaurants";
import { attachMercadoPagoPreapproval, getSubscriptionForRestaurant } from "../../db/subscriptions";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { createSubscriptionPreapproval } from "../../_core/mercadoPagoBilling";
import { ENV } from "../../_core/env";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

export const masterPanelBillingRouter = router({
  /**
   * Cria a assinatura recorrente no Mercado Pago (conta da PLATAFORMA, nunca
   * a de nenhum restaurante) e devolve o link de autorização — quem precisa
   * abrir esse link e confirmar é o dono do restaurante-cliente, não você.
   * Enquanto ele não autoriza, a assinatura fica "payment_pending" (ver
   * webhook subscription_preapproval).
   */
  startMercadoPagoSubscription: platformAdminProcedureFor("billing").input(z.object({ restaurantId: z.number().int().positive(), backUrl: z.string().url() })).mutation(async ({ input, ctx }) => {
    if (!ENV.mercadoPagoAccessToken) {
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Cobrança automática não está configurada (MERCADO_PAGO_ACCESS_TOKEN em branco)." });
    }
    const restaurant = await getRestaurantById(input.restaurantId);
    if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
    if (!restaurant.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre o e-mail de contato deste restaurante antes de configurar a cobrança." });
    const current = await getSubscriptionForRestaurant(input.restaurantId);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante sem assinatura cadastrada." });

    const preapproval = await createSubscriptionPreapproval({
      accessToken: ENV.mercadoPagoAccessToken,
      reason: `Assinatura Pub X SaaS — plano ${current.plan.name}`,
      externalReference: `restaurant:${restaurant.id}`,
      payerEmail: restaurant.contactEmail,
      backUrl: input.backUrl,
      amountCents: current.plan.priceCents,
    });
    const actor = `platform_admin:${ctx.platformAdmin.email}`;
    await attachMercadoPagoPreapproval({ restaurantId: restaurant.id, preapprovalId: preapproval.id, actor });
    await recordPlatformAuditLog({
      actorAdminId: ctx.platformAdmin.id,
      actorLabel: ctx.platformAdmin.email,
      action: "restaurant.mercadopago_subscription_started",
      entityType: "restaurant",
      entityId: restaurant.id,
      after: { preapprovalId: preapproval.id },
      ip: ctx.req.ip,
    });
    return { authorizationUrl: preapproval.initPoint };
  }),
});
