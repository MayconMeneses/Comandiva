import type { Express, Request, Response } from "express";
import { checkRateLimit } from "../../_core/rateLimit";
import { sendOwnerAlert } from "../../_core/alerts";
import { getActiveGatewayAndProvider } from "../paymentService";
import { applyPaymentStatusNotification } from "../paymentService";

let warnedMissingSecretOnce = false;

/**
 * Cobre tanto cartão (Checkout Pro) quanto Pix (Payments API) — os dois são
 * notificações `type: "payment"` do Mercado Pago, então é o mesmo endpoint;
 * o que muda é só o `payment_method_id` dentro do pagamento consultado, que
 * não precisamos nem olhar aqui (o mapeamento de status é o mesmo pros dois).
 */
export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  // Responder rápido é parte do contrato do Mercado Pago (eles reenviam se
  // demorar ou se a resposta não for 2xx) — nosso processamento aqui é só
  // uma consulta HTTP + updates simples, cabe folgado dentro do timeout deles.
  // Limite bem mais alto que o padrão (pensado pra força bruta de login):
  // isso é tráfego servidor-a-servidor do próprio Mercado Pago, cobrindo
  // TODAS as notificações de TODOS os pagamentos — um limite apertado aqui
  // faz o handler devolver 200 sem checar nada, e o MP nunca reenvia um 2xx.
  const limit = checkRateLimit(`mp-webhook:${req.ip}`, { maxAttempts: 60 });
  if (!limit.allowed) {
    // 429 (e não 200): com 200 o Mercado Pago dava a notificação por entregue e
    // nunca reenviava — uma confirmação de pagamento ficava perdida.
    res.status(429).json({ received: false });
    return;
  }

  try {
    const body = req.body as { type?: string; topic?: string; data?: { id?: string | number } } | undefined;
    const type = body?.type ?? body?.topic ?? (req.query.type as string | undefined) ?? (req.query.topic as string | undefined);
    // Um id só, o da QUERY (é o que a assinatura cobre). Se o corpo trouxer um id
    // DIFERENTE, é uma notificação adulterada: assinar o id X e consultar o Y.
    const queryId = (req.query["data.id"] as string | undefined) ?? (req.query.id as string | undefined);
    const bodyId = body?.data?.id;
    const paymentId = queryId ?? bodyId;

    if (type !== "payment" || !paymentId) {
      res.status(200).json({ received: true });
      return;
    }
    if (queryId && bodyId !== undefined && String(queryId) !== String(bodyId)) {
      console.warn("[webhook] id do corpo diverge do id da query — notificação ignorada.");
      res.status(200).json({ received: true });
      return;
    }

    const { gateway, provider } = await getActiveGatewayAndProvider().catch(() => ({ gateway: null, provider: null }));
    if (!gateway || !provider) {
      res.status(200).json({ received: true });
      return;
    }

    // Assinatura OBRIGATÓRIA (auditoria 2026-10-10). Sem a "chave secreta" do webhook
    // (Central de vendedores → Webhooks → Assinatura secreta) o aviso NÃO é processado:
    // qualquer um pode fazer POST aqui, e só a reconsulta à API do MP deixava de ser a
    // única barreira. 503 (e não 200) pro Mercado Pago REENVIAR depois que a chave for
    // configurada; o Admin também não deixa ativar o Mercado Pago sem ela.
    if (!gateway.secretKey) {
      if (!warnedMissingSecretOnce) {
        warnedMissingSecretOnce = true;
        console.error("[webhook] Gateway Mercado Pago ativo SEM 'chave secreta' de webhook (Admin → Conta): notificações recusadas até configurar.");
        void sendOwnerAlert("Mercado Pago sem chave secreta de webhook", "O gateway Mercado Pago está ativo mas sem a 'chave secreta' do webhook: confirmações de pagamento estão sendo recusadas. Preencha em Admin → Conta.", "mercadoPagoNoWebhookSecret", undefined, "Pagamento de pedido (webhook Mercado Pago)");
      }
      res.status(503).json({ received: false });
      return;
    }
    const dataIdForSignature = queryId ?? paymentId;
    const validSignature = provider.verifyWebhookSignature({
      xSignature: req.header("x-signature"),
      xRequestId: req.header("x-request-id"),
      dataId: dataIdForSignature ? String(dataIdForSignature) : undefined,
      secret: gateway.secretKey,
    });
    if (!validSignature) {
      // Falha de assinatura = "não é uma notificação de verdade": ignora sem chamar a API (200: não adianta reenviar).
      console.warn("[webhook] Assinatura do Mercado Pago inválida — ignorando notificação.");
      res.status(200).json({ received: true });
      return;
    }

    // Nunca confiamos no corpo do webhook em si — qualquer um pode fazer POST
    // aqui. A verdade vem da própria API do Mercado Pago, consultada com
    // nosso access token.
    const payment = await provider.getPaymentStatus(gateway.apiKey, String(paymentId));
    await applyPaymentStatusNotification({
      gatewayName: gateway.provider,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      externalReference: payment.externalReference,
      amountCents: payment.amountCents,
      currency: payment.currency,
    });
    res.status(200).json({ received: true });
  } catch (error) {
    // Diferente dos retornos 200 acima (casos esperados: tipo desconhecido,
    // sem gateway ativo, assinatura inválida), chegar aqui é uma falha real
    // (erro transitório de banco, API do Mercado Pago fora do ar etc.) — e
    // responder 200 mesmo assim faria o Mercado Pago achar que processou
    // com sucesso e nunca mais reenviar essa notificação, perdendo a
    // confirmação de pagamento pra sempre. Responder erro aciona o reenvio
    // automático deles (contrato documentado do Mercado Pago para webhooks).
    console.error("[webhook] Falha ao processar notificação do Mercado Pago:", error);
    void sendOwnerAlert("Falha no webhook de pagamento (Mercado Pago)", error instanceof Error ? (error.stack ?? error.message) : String(error), "mercadoPagoWebhook", undefined, "Pagamento de pedido (webhook Mercado Pago)");
    res.status(500).json({ received: false });
  }
}

export function registerMercadoPagoWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago", handleMercadoPagoWebhook);
}
