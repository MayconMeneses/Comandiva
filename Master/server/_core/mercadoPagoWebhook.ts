import type { Express, Request, Response } from "express";
import { applyDueScheduledChanges, applyPreapprovalStatus, getSubscriptionByGatewaySubscriptionId, markSubscriptionPastDue, notifySubscriptionRenewed, recordBillingPayment } from "../db/subscriptions";
import { markWebhookEventOnce, unmarkWebhookEvent } from "../db/webhookEvents";
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
  // Chave já gravada como "processada" — se aplicar o efeito falhar, é desfeita no catch pro reenvio do MP funcionar.
  let markedEventId: string | undefined;
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

    // Assinatura OBRIGATÓRIA (auditoria 2026-10-10): sem a "Assinatura secreta" do webhook o aviso
    // não é processado (503: o Mercado Pago reenvia depois que for configurada).
    if (!ENV.mercadoPagoWebhookSecret) {
      console.error("[billing-webhook] MERCADO_PAGO_WEBHOOK_SECRET ausente — notificações recusadas.");
      res.status(503).json({ received: false });
      return;
    }
    {
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
      const eventId = `${type}:${dataId}:${preapproval.status}`;
      const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: eventId, result: "received" });
      if (alreadyProcessed) {
        res.status(200).json({ received: true });
        return;
      }
      markedEventId = eventId;
      await applyPreapprovalStatus({ preapprovalId: preapproval.id, mpStatus: preapproval.status, payerId: preapproval.payerId });
    } else {
      const payment = await getAuthorizedPayment(ENV.mercadoPagoAccessToken, dataId);
      const eventId = `${type}:${dataId}:${payment.status}`;
      const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: eventId, result: "received" });
      if (alreadyProcessed) {
        res.status(200).json({ received: true });
        return;
      }
      markedEventId = eventId;
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
    void alertSystemError("Falha no webhook de cobrança (Mercado Pago)", error instanceof Error ? (error.stack ?? error.message) : String(error), "mercadoPagoBillingWebhook", "Cobrança de assinatura (webhook Mercado Pago)");
    // Falha real: desfaz o "já processado" e responde 500 — o Mercado Pago reenvia a
    // notificação. Antes respondia 200 e o pagamento/ativação ficava perdido.
    if (markedEventId) await unmarkWebhookEvent({ gateway: "mercadopago", gatewayEventId: markedEventId }).catch(() => {});
    res.status(500).json({ received: false });
    return;
  }
  res.status(200).json({ received: true });
}

export function registerMercadoPagoBillingWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago-billing", handleMercadoPagoBillingWebhook);
}
