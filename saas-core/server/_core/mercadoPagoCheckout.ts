import { ENV } from "./env";

/**
 * Taxa de implementação (pagamento único) via Mercado Pago Checkout Pro —
 * API de "preferences"/"payments", diferente da API de assinatura/preapproval
 * usada pela mensalidade recorrente (mercadoPagoBilling.ts). Mesmo estilo de
 * chamada crua via fetch, sem SDK, e mesmo cuidado de nunca vazar o corpo de
 * resposta do Mercado Pago (conta da PLATAFORMA) pro visitante do site.
 */

export type CreatedPreference = { id: string; initPoint: string };

export async function createImplementationFeePreference(params: {
  accessToken: string;
  title: string;
  externalReference: string;
  amountCents: number;
  payerEmail: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  // URL de notificação (webhook) desta preferência especificamente — não dá
  // pra depender só da URL cadastrada no painel do Mercado Pago (o painel
  // deles só aceita UMA URL por aplicação/ambiente, ver
  // mercadoPagoWebhookRoute.ts; se ela ficar desatualizada — como aconteceu
  // em produção em 2026-09-17 — nenhuma preferência recebe notificação,
  // mesmo com o pagamento aprovado do lado deles). Setar aqui garante que
  // funciona de qualquer forma, independente da config do painel.
  notificationUrl: string;
  // Device ID do security.js (window.MP_DEVICE_SESSION_ID), capturado no
  // frontend antes de criar a preferência — sem isso, o motor de risco do
  // Mercado Pago não tem o fingerprint do dispositivo associado a ESTA
  // transação específica e pode travar o botão de pagar no checkout
  // hospedado deles (visto em produção no Safari/iPhone). Ver
  // useMercadoPagoSecurity.ts + docs deles sobre header X-meli-session-id.
  deviceId?: string;
}): Promise<CreatedPreference> {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.deviceId ? { "X-meli-session-id": params.deviceId } : {}),
    },
    body: JSON.stringify({
      items: [{ title: params.title, quantity: 1, unit_price: params.amountCents / 100, currency_id: "BRL" }],
      external_reference: params.externalReference,
      payer: { email: params.payerEmail },
      back_urls: { success: params.successUrl, failure: params.failureUrl, pending: params.pendingUrl },
      auto_return: "approved",
      notification_url: params.notificationUrl,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[mercadoPagoCheckout] Recusou a criação da preferência (status ${response.status}):`, detail.slice(0, 300));
    throw new Error("Mercado Pago recusou a criação do checkout. Tente novamente ou contate o suporte.");
  }
  const data = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string };
  const initPoint = ENV.isProduction ? data.init_point : (data.init_point ?? data.sandbox_init_point);
  if (!initPoint) throw new Error("Mercado Pago não retornou um link de checkout.");
  return { id: data.id, initPoint };
}

/**
 * Estado real de um pagamento único — nunca confiar no corpo do webhook,
 * sempre reconsultar aqui antes de considerar aprovado (mesmo raciocínio de
 * getSubscriptionPreapproval em mercadoPagoBilling.ts).
 */
export async function getPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Mercado Pago recusou a consulta do pagamento (status ${response.status}).`);
  const data = (await response.json()) as { id: number; status: string; external_reference?: string | null; transaction_amount?: number | null };
  return {
    id: String(data.id),
    status: data.status,
    externalReference: data.external_reference ?? null,
    amountCents: data.transaction_amount != null ? Math.round(data.transaction_amount * 100) : null,
  };
}
