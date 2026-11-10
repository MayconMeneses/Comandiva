import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getRestaurantById } from "../../db/restaurants";
import { attachMercadoPagoPreapproval, getSubscriptionForRestaurant } from "../../db/subscriptions";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { createSubscriptionPreapproval } from "../../_core/mercadoPagoBilling";
import { ENV } from "../../_core/env";
import { platformAdminProcedureFor, router } from "../../_core/trpc";
import { isSafeHttpsUrl } from "../../_core/urlSafety";
import { PLATFORM_NAME } from "../../../shared/branding";

/**
 * Para onde o Mercado Pago devolve o dono depois de autorizar: a página
 * "Meu plano" do PRÓPRIO restaurante (`<deploymentUrl>/admin/plano`), a mesma
 * que o fluxo self-service usa. Montada aqui no servidor a partir do
 * deploymentUrl cadastrado — nunca aceita URL vinda do cliente, e nunca
 * pode ser o endereço do Painel Master (que cairia na tela de login).
 */
export function buildAuthorizationBackUrl(deploymentUrl: string | null | undefined): string | null {
  if (!deploymentUrl || !isSafeHttpsUrl(deploymentUrl)) return null;
  return `${deploymentUrl.replace(/\/+$/, "")}/admin/plano`;
}

export const masterPanelBillingRouter = router({
  /**
   * Cria a assinatura recorrente no Mercado Pago (conta da PLATAFORMA, nunca
   * a de nenhum restaurante) e devolve o link de autorização — quem precisa
   * abrir esse link e confirmar é o dono do restaurante-cliente, não você.
   * Enquanto ele não autoriza, a assinatura fica "payment_pending" (ver
   * webhook subscription_preapproval).
   */
  startMercadoPagoSubscription: platformAdminProcedureFor("billing").input(z.object({ restaurantId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    if (!ENV.mercadoPagoAccessToken) {
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Cobrança automática não está configurada (MERCADO_PAGO_ACCESS_TOKEN em branco)." });
    }
    const restaurant = await getRestaurantById(input.restaurantId);
    if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
    if (!restaurant.contactEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre o e-mail de contato deste restaurante antes de configurar a cobrança." });
    const current = await getSubscriptionForRestaurant(input.restaurantId);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante sem assinatura cadastrada." });
    // Assinatura ativa já ligada ao Mercado Pago: gerar outra autorização
    // criaria uma segunda preapproval e cobrança duplicada. A tela já esconde
    // o botão, mas a regra precisa valer também para quem chamar a API direto.
    if (current.subscription.status === "active" && current.subscription.gatewaySubscriptionId) {
      throw new TRPCError({ code: "CONFLICT", message: "Este restaurante já tem cobrança automática ativa no Mercado Pago. Para trocar de plano, use a troca de plano em vez de criar nova autorização." });
    }
    const backUrl = buildAuthorizationBackUrl(restaurant.deploymentUrl);
    if (!backUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cadastre o endereço (https://) do restaurante antes de gerar o link de cobrança: é para lá que o cliente volta depois de autorizar." });
    }

    const preapproval = await createSubscriptionPreapproval({
      accessToken: ENV.mercadoPagoAccessToken,
      reason: `Assinatura ${PLATFORM_NAME} — plano ${current.plan.name}`,
      externalReference: `restaurant:${restaurant.id}`,
      payerEmail: restaurant.contactEmail,
      backUrl,
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
