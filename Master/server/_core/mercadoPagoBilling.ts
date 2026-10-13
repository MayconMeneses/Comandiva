import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

/**
 * Cobrança recorrente da mensalidade do SaaS via Mercado Pago (API de
 * assinaturas/"preapproval" — diferente do Checkout Pro usado por cada
 * restaurante pros próprios clientes finais). Chamadas cruas via fetch, sem
 * SDK, mesmo estilo já usado no app principal (server/_core/mercadoPago.ts).
 */

export type CreatedPreapproval = { id: string; initPoint: string; status: string };

export async function createSubscriptionPreapproval(params: {
  accessToken: string;
  reason: string;
  externalReference: string;
  payerEmail: string;
  backUrl: string;
  amountCents: number;
  // Device ID do security.js (window.MP_DEVICE_SESSION_ID) — ver o mesmo
  // parâmetro em mercadoPagoCheckout.ts::createImplementationFeePreference
  // pro contexto completo do bug que isso corrige.
  deviceId?: string;
}): Promise<CreatedPreapproval> {
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.deviceId ? { "X-meli-session-id": params.deviceId } : {}),
    },
    body: JSON.stringify({
      reason: params.reason,
      external_reference: params.externalReference,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amountCents / 100,
        currency_id: "BRL",
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // O corpo da resposta é da conta do Mercado Pago da PLATAFORMA, não do
    // restaurante que chamou billing.changePlan — nunca repassar pro
    // tenant (billing.ts encaminha error.message direto pro cliente). Loga
    // completo só no servidor.
    console.error(`[mercadoPagoBilling] Recusou a criação da assinatura (status ${response.status}):`, detail.slice(0, 300));
    throw new Error("Mercado Pago recusou a criação da assinatura. Tente novamente ou contate o suporte.");
  }
  const data = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string; status: string };
  const initPoint = ENV.isProduction ? data.init_point : (data.init_point ?? data.sandbox_init_point);
  if (!initPoint) throw new Error("Mercado Pago não retornou um link de autorização para a assinatura.");
  return { id: data.id, initPoint, status: data.status };
}

/**
 * Atualiza uma preapproval já existente — usada tanto pra upgrade imediato
 * (troca o valor da PRÓXIMA cobrança pro preço do novo plano; o Mercado Pago
 * não tem cobrança proporcional/crédito pra preapproval, então não inventamos
 * nenhuma — o cliente já usa o plano novo na hora, paga o valor novo a partir
 * do próximo ciclo) quanto pra aplicar um downgrade agendado no vencimento,
 * e pra cancelar de fato quando um cancelamento agendado se efetiva.
 */
export async function updateSubscriptionPreapproval(params: { accessToken: string; preapprovalId: string; amountCents?: number; status?: "paused" | "cancelled" }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (params.amountCents != null) body.auto_recurring = { transaction_amount: params.amountCents / 100, currency_id: "BRL" };
  if (params.status) body.status = params.status;
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(params.preapprovalId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${params.accessToken}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    // Mesmo raciocínio de createSubscriptionPreapproval acima — nunca
    // repassar o corpo cru da resposta (conta da plataforma) pro tenant.
    console.error(`[mercadoPagoBilling] Recusou a atualização da assinatura (status ${response.status}):`, detail.slice(0, 300));
    throw new Error("Mercado Pago recusou a atualização da assinatura. Tente novamente ou contate o suporte.");
  }
}

/** Estado atual da assinatura — usado tanto sob demanda quanto a partir do webhook. */
export async function getSubscriptionPreapproval(accessToken: string, preapprovalId: string) {
  const response = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(preapprovalId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Mercado Pago recusou a consulta da assinatura (status ${response.status}).`);
  const data = (await response.json()) as { id: string; status: string; external_reference?: string | null; payer_id?: number | null };
  return { id: data.id, status: data.status, externalReference: data.external_reference ?? null, payerId: data.payer_id ?? null };
}

/**
 * Uma cobrança individual dentro da assinatura (o webhook
 * `subscription_authorized_payment` avisa o id desta linha, nunca o valor
 * em si — a verdade sempre vem consultando aqui, nunca do corpo do webhook).
 */
export async function getAuthorizedPayment(accessToken: string, authorizedPaymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Mercado Pago recusou a consulta da cobrança (status ${response.status}).`);
  const data = (await response.json()) as { id: string; status: string; preapproval_id?: string | null; transaction_amount?: number | null };
  return { id: data.id, status: data.status, preapprovalId: data.preapproval_id ?? null, amountCents: data.transaction_amount != null ? Math.round(data.transaction_amount * 100) : null };
}

/**
 * Mesmo esquema documentado pelo Mercado Pago usado em server/_core/mercadoPago.ts
 * do app principal (HMAC-SHA256 sobre `id:...;request-id:...;ts:...;`) — copiado
 * aqui, não importado de lá, porque saas-core é um serviço/deployment
 * separado, com seu próprio package.json e sua própria conta do Mercado Pago
 * (a chave secreta é outra, do App do Mercado Pago da PLATAFORMA).
 */
export function verifyMercadoPagoWebhookSignature(params: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  if (!params.xSignature) return false;
  const parts = Object.fromEntries(
    params.xSignature.split(",").map(pair => {
      const [key, value] = pair.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  let manifest = "";
  if (params.dataId) manifest += `id:${params.dataId};`;
  if (params.xRequestId) manifest += `request-id:${params.xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", params.secret).update(manifest).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(v1, "hex");
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}
