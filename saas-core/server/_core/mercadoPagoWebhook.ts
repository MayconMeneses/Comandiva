import type { Express, Request, Response } from "express";
import { applyDueScheduledChanges, applyPreapprovalStatus, getSubscriptionByGatewaySubscriptionId, markSubscriptionPastDue, notifySubscriptionRenewed, recordBillingPayment } from "../db/subscriptions";
import { markWebhookEventOnce } from "../db/webhookEvents";
import { getSubscriptionPreapproval, getAuthorizedPayment, verifyMercadoPagoWebhookSignature } from "./mercadoPagoBilling";
import { ENV } from "./env";
import { alertSystemError } from "./telegramService";

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

    // A chave de dedup PRECISA incluir o status atual, não só `${type}:${dataId}`:
    // `data.id` é o id da própria preapproval/cobrança, que não muda entre
    // notificações de estados diferentes (pending -> authorized -> cancelled
    // são notificações DIFERENTES sobre o MESMO data.id). Sem o status na
    // chave, a segunda notificação (ex: cliente autoriza de verdade) era
    // descartada como "já processada" pela primeira (criação, status
    // pending), e a assinatura ficava travada em payment_pending pra sempre.
    // O status de verdade só existe consultando a API do Mercado Pago (o
    // corpo do webhook nunca traz o status) — por isso a consulta acontece
    // ANTES da checagem de idempotência, com o valor consultado reaproveitado
    // na aplicação abaixo (nunca consultado duas vezes). Retry idêntico do
    // Mercado Pago da MESMA notificação (mesmo data.id, mesmo status) continua
    // gerando a mesma chave e sendo descartado normalmente.
    if (type === "subscription_preapproval") {
      const preapproval = await getSubscriptionPreapproval(ENV.mercadoPagoAccessToken, dataId);
      const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: `${type}:${dataId}:${preapproval.status}`, result: "received" });
      if (alreadyProcessed) {
        res.status(200).json({ received: true });
        return;
      }
      await applyPreapprovalStatus({ preapprovalId: preapproval.id, mpStatus: preapproval.status, payerId: preapproval.payerId });
    } else {
      const payment = await getAuthorizedPayment(ENV.mercadoPagoAccessToken, dataId);
      const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: `${type}:${dataId}:${payment.status}`, result: "received" });
      if (alreadyProcessed) {
        res.status(200).json({ received: true });
        return;
      }
      if (payment.preapprovalId) {
        const subscription = await getSubscriptionByGatewaySubscriptionId(payment.preapprovalId);
        if (subscription) {
          if (payment.status === "recycling") {
            // Cobrança recusada, Mercado Pago tentando de novo automaticamente
            // — status inequívoco (diferente de "processed", que pode
            // significar sucesso OU falha definitiva). NUNCA adianta
            // currentPeriodEnd aqui: o cliente não pode ganhar acesso de
            // graça só porque o cartão recusou.
            await markSubscriptionPastDue(subscription.id);
          } else {
            // Uma cobrança de renovação real é o sinal mais confiável de que o
            // ciclo virou — aplica downgrade/cancelamento agendado aqui,
            // além do polling periódico (computeSnapshotForRestaurant), que é
            // só o reforço/fallback.
            const wasActive = subscription.status === "active";
            await applyDueScheduledChanges(subscription.id);
            if (wasActive && payment.amountCents != null) {
              await notifySubscriptionRenewed(subscription.id, payment.amountCents);
            }
          }
          await recordBillingPayment({ preapprovalId: payment.preapprovalId, gatewayPaymentId: payment.id, amountCents: payment.amountCents, mpStatus: payment.status });
        }
      }
    }
  } catch (error) {
    console.error("[billing-webhook] Falha ao processar notificação do Mercado Pago:", error);
    void alertSystemError("Falha no webhook de cobrança (Mercado Pago)", error instanceof Error ? (error.stack ?? error.message) : String(error), "mercadoPagoBillingWebhook");
  }
  res.status(200).json({ received: true });
}

export function registerMercadoPagoBillingWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago-billing", handleMercadoPagoBillingWebhook);
}
