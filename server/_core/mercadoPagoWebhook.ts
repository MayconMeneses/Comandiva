import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { paymentGateways } from "../../drizzle/schema";
import { markOrderPaymentPaidByPublicCode } from "../db";
import { getMercadoPagoPayment, verifyMercadoPagoWebhookSignature } from "./mercadoPago";
import { getDb } from "../db";
import { checkRateLimit } from "./rateLimit";

export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  // Responder rápido é parte do contrato do Mercado Pago (eles reenviam se
  // demorar ou se a resposta não for 2xx) — nosso processamento aqui é só
  // uma consulta HTTP + updates simples, cabe folgado dentro do timeout deles.
  const limit = checkRateLimit(`mp-webhook:${req.ip}`);
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

    const db = await getDb();
    if (!db) {
      res.status(200).json({ received: true });
      return;
    }

    const [gateway] = await db.select().from(paymentGateways).where(eq(paymentGateways.provider, "MERCADO_PAGO")).limit(1);
    if (!gateway?.active || !gateway.apiKey) {
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
      const validSignature = verifyMercadoPagoWebhookSignature({
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
    }

    // Nunca confiamos no corpo do webhook em si — qualquer um pode fazer POST
    // aqui. A verdade vem da própria API do Mercado Pago, consultada com
    // nosso access token. Se o ID não existir ou não bater com um pedido
    // nosso (external_reference), simplesmente não acontece nada.
    const payment = await getMercadoPagoPayment(gateway.apiKey, String(paymentId));
    if (payment.status === "approved" && payment.externalReference) {
      await markOrderPaymentPaidByPublicCode(payment.externalReference, String(payment.id));
    }
  } catch (error) {
    console.error("[webhook] Falha ao processar notificação do Mercado Pago:", error);
  }

  res.status(200).json({ received: true });
}

export function registerMercadoPagoWebhook(app: Express) {
  app.post("/api/webhooks/mercadopago", handleMercadoPagoWebhook);
}
