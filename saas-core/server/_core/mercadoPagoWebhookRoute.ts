import type { Express, Request, Response } from "express";
import { handleMercadoPagoBillingWebhook } from "./mercadoPagoWebhook";
import { handleMercadoPagoSignupWebhook } from "./mercadoPagoSignupWebhook";

/**
 * Ponto de entrada ÚNICO pro webhook do Mercado Pago da PLATAFORMA
 * (/api/webhooks/mercadopago) — o painel de desenvolvedor do Mercado Pago só
 * aceita UMA URL cadastrada por aplicação/ambiente (os eventos selecionados,
 * de qualquer tipo, chegam todos nela, nunca em URLs separadas por tópico).
 * As rotas antigas (mercadopago-signup/mercadopago-billing) continuam
 * registradas e funcionando — cada handler já filtra por `type` e ignora o
 * que não é dele — só que agora nenhuma das duas isoladas cobre o app
 * inteiro; é esta rota combinada que deve ser cadastrada na MP dali pra
 * frente. `type === "payment"` é sempre a taxa de implementação (Checkout
 * Pro, pagamento avulso); qualquer outro tipo relevante (subscription_*) é
 * cobrança recorrente da mensalidade.
 */
export async function handleMercadoPagoWebhook(req: Request, res: Response) {
  const body = req.body as { type?: string } | undefined;
  const type = body?.type ?? (req.query.type as string | undefined) ?? (req.query.topic as string | undefined);

  if (type === "payment") {
    await handleMercadoPagoSignupWebhook(req, res);
    return;
  }
  await handleMercadoPagoBillingWebhook(req, res);
}

export function registerMercadoPagoWebhookRoute(app: Express) {
  app.post("/api/webhooks/mercadopago", handleMercadoPagoWebhook);
}
