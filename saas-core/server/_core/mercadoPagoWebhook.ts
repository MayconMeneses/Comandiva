import type { Express, Request, Response } from "express";
import { applyDueScheduledChanges, applyPreapprovalStatus, getSubscriptionByGatewaySubscriptionId, recordBillingPayment } from "../db/subscriptions";
import { markWebhookEventOnce } from "../db/webhookEvents";
import { getSubscriptionPreapproval, getAuthorizedPayment, verifyMercadoPagoWebhookSignature } from "./mercadoPagoBilling";
import { ENV } from "./env";

/**
 * Webhook da cobrança da mensalidade do SaaS (restaurante-cliente pagando a
 * plataforma) — nunca confundir com o webhook de pedidos de cada
 * restaurante (esse fica no deployment de cada um, nunca chega aqui).
 * Dois tópicos different: `subscription_preapproval` (a assinatura em si
 * mudou de estado — pendente/autorizada/pausada/cancelada) e
 * `subscription_authorized_payment` (uma cobrança mensal específica
 * aconteceu). Responde 200 sempre e rápido — notificação de assinatura do
 * Mercado Pago não tem retry se a resposta não vier a tempo.
 */
export async function handleMercadoPagoBillingWebhook(req: Request, res: Response) {
  try {
    const body = req.body as { type?: string; action?: string; data?: { id?: string } } | undefined;
    const type = body?.type ?? (req.query.type as string | undefined) ?? (req.query.topic as string | undefined);
    const dataId = body?.data?.id ?? (req.query["data.id"] as string | undefined);
    if (!dataId || (type !== "subscription_preapproval" && type !== "subscription_authorized_payment")) {
      res.status(200).json({ received: true });
      return;
    }
    if (!ENV.mercadoPagoAccessToken) {
      res.status(200).json({ received: true });
      return;
    }

    if (ENV.mercadoPagoWebhookSecret) {
      const valid = verifyMercadoPagoWebhookSignature({
        xSignature: req.header("x-signature"),
        xRequestId: req.header("x-request-id"),
        dataId,
        secret: ENV.mercadoPagoWebhookSecret,
      });
      if (!valid) {
        console.warn("[billing-webhook] Assinatura do Mercado Pago inválida — ignorando notificação.");
        res.status(200).json({ received: true });
        return;
      }
    }

    const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: `${type}:${dataId}`, result: "received" });
    if (alreadyProcessed) {
      res.status(200).json({ received: true });
      return;
    }

    if (type === "subscription_preapproval") {
      const preapproval = await getSubscriptionPreapproval(ENV.mercadoPagoAccessToken, dataId);
      await applyPreapprovalStatus({ preapprovalId: preapproval.id, mpStatus: preapproval.status, payerId: preapproval.payerId });
    } else {
      const payment = await getAuthorizedPayment(ENV.mercadoPagoAccessToken, dataId);
      if (payment.preapprovalId) {
        const subscription = await getSubscriptionByGatewaySubscriptionId(payment.preapprovalId);
        if (subscription) {
          // Uma cobrança de renovação real é o sinal mais confiável de que o
          // ciclo virou — aplica downgrade/cancelamento agendado aqui,
          // além do polling periódico (computeSnapshotForRestaurant), que é
          // só o reforço/fallback.
          await applyDueScheduledChanges(subscription.id);
          await recordBillingPayment({ preapprovalId: payment.preapprovalId, gatewayPaymentId: payment.id, amountCents: payment.amountCents, mpStatus: payment.status });
        }
      }
    }
  } catch (error) {
    console.error("[billing-webhook] Falha ao processar notificação do Mercado Pago:", error);
  }
  res.status(200).json({ received: true });
}

export function registerMercadoPagoBillingWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago-billing", handleMercadoPagoBillingWebhook);
}
