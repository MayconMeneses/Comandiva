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
    res.status(200).json({ received: true });
    return;
  }

  try {
    const body = req.body as { type?: string; topic?: string; data?: { id?: string | number } } | undefined;
    const type = body?.type ?? body?.topic ?? (req.query.type as string | undefined) ?? (req.query.topic as string | undefined);
    const paymentId = body?.data?.id ?? (req.query["data.id"] as string | undefined) ?? (req.query.id as string | undefined);

    if (type !== "payment" || !paymentId) {
      res.status(200).json({ received: true });
      return;
    }

    const { gateway, provider } = await getActiveGatewayAndProvider().catch(() => ({ gateway: null, provider: null }));
    if (!gateway || !provider) {
      res.status(200).json({ received: true });
      return;
    }

    // Assinatura só é exigida se o admin já configurou a "chave secreta" de
    // webhook no Mercado Pago (Central de vendedores → Webhooks) — enquanto
    // isso não for feito, o comportamento continua igual ao de antes (a
    // consulta à API abaixo já é a proteção real contra corpo forjado).
    // Falha de assinatura é tratada como "não é uma notificação de verdade":
    // ignora sem chamar a API, mas ainda responde 200 (contrato do MP).
    if (gateway.secretKey) {
      const dataIdForSignature = (req.query["data.id"] as string | undefined) ?? paymentId;
      const validSignature = provider.verifyWebhookSignature({
        xSignature: req.header("x-signature"),
        xRequestId: req.header("x-request-id"),
        dataId: dataIdForSignature ? String(dataIdForSignature) : undefined,
        secret: gateway.secretKey,
      });
      if (!validSignature) {
        console.warn("[webhook] Assinatura do Mercado Pago inválida — ignorando notificação.");
        res.status(200).json({ received: true });
        return;
      }
    } else if (!warnedMissingSecretOnce) {
      // Diferente do JWT_SECRET, isto não trava o boot — a chave secreta do
      // webhook é configurada por restaurante (Admin → Conta), não por env
      // global, então não dá pra checar antes do primeiro webhook chegar. A
      // consulta à API do MP logo abaixo já protege contra corpo forjado
      // mesmo sem assinatura, mas fica sem essa camada extra até configurar.
      warnedMissingSecretOnce = true;
      console.warn("[webhook] Gateway Mercado Pago ativo sem 'chave secreta' de webhook configurada (Admin → Conta) — notificações não têm verificação de assinatura.");
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
    void sendOwnerAlert("Falha no webhook de pagamento (Mercado Pago)", error instanceof Error ? (error.stack ?? error.message) : String(error), "mercadoPagoWebhook");
    res.status(500).json({ received: false });
  }
}

export function registerMercadoPagoWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago", handleMercadoPagoWebhook);
}
