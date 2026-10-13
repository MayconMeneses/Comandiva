import type { Express, Request, Response } from "express";
import { confirmSignupPaymentAndCreateRestaurant } from "../db/signupPayments";
import { markWebhookEventOnce, unmarkWebhookEvent } from "../db/webhookEvents";
import { getPayment } from "./mercadoPagoCheckout";
import { verifyMercadoPagoWebhookSignature } from "./mercadoPagoBilling";
import { ENV } from "./env";
import { alertSystemError } from "./telegramService";

/**
 * Webhook da TAXA DE IMPLEMENTAÇÃO (pagamento único, Checkout Pro) — rota
 * própria, separada de /api/webhooks/mercadopago-billing (que já filtra só
 * os tópicos de assinatura recorrente da mensalidade e ignoraria `payment`
 * silenciosamente). Mesma regra de ouro do resto do billing: status real
 * sempre vem de reconsultar a API do Mercado Pago, nunca do corpo da
 * notificação nem do retorno da URL de sucesso.
 */
export async function handleMercadoPagoSignupWebhook(req: Request, res: Response) {
  let markedEventId: string | undefined;
  try {
    const body = req.body as { type?: string; data?: { id?: string } } | undefined;
    const type = body?.type ?? (req.query.type as string | undefined) ?? (req.query.topic as string | undefined);
    const dataId = body?.data?.id ?? (req.query["data.id"] as string | undefined);
    if (!dataId || type !== "payment") {
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
      console.error("[signup-webhook] MERCADO_PAGO_WEBHOOK_SECRET ausente — notificações recusadas.");
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
        console.warn("[signup-webhook] Assinatura do Mercado Pago inválida — ignorando notificação.");
        res.status(200).json({ received: true });
        return;
      }
    }

    const payment = await getPayment(ENV.mercadoPagoAccessToken, dataId);

    // Mesma chave de dedup incluindo o status (não só o id do pagamento) —
    // ver comentário detalhado em mercadoPagoWebhook.ts sobre por que isso é
    // necessário (retries do MP reenviam o mesmo id em estados diferentes).
    const eventId = `payment:${dataId}:${payment.status}`;
    const { alreadyProcessed } = await markWebhookEventOnce({ gateway: "mercadopago", gatewayEventId: eventId, result: "received" });
    if (alreadyProcessed) {
      res.status(200).json({ received: true });
      return;
    }
    markedEventId = eventId;

    if (payment.status === "approved" && payment.externalReference) {
      // external_reference é o ID (numérico) da linha signup_payments — ver
      // server/routers/public.ts::signup, que grava exatamente esse valor
      // como external_reference ao criar a preferência.
      const signupPaymentId = Number(payment.externalReference);
      if (Number.isFinite(signupPaymentId)) {
        await confirmSignupPaymentAndCreateRestaurant(signupPaymentId, payment.id);
      }
    }
  } catch (error) {
    console.error("[signup-webhook] Falha ao processar notificação do Mercado Pago:", error);
    void alertSystemError("Falha no webhook de taxa de implementação (Mercado Pago)", error instanceof Error ? (error.stack ?? error.message) : String(error), "mercadoPagoSignupWebhook", "Site comercial — pagamento de cadastro (webhook Mercado Pago)");
    if (markedEventId) await unmarkWebhookEvent({ gateway: "mercadopago", gatewayEventId: markedEventId }).catch(() => {});
    res.status(500).json({ received: false });
    return;
  }
  res.status(200).json({ received: true });
}

export function registerMercadoPagoSignupWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago-signup", handleMercadoPagoSignupWebhook);
}
