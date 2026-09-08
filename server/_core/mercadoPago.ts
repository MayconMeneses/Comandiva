import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./env";

type PreferenceItem = { title: string; quantity: number; unit_price: number };

/**
 * Cria uma "preferência" de pagamento no Mercado Pago Checkout Pro e retorna
 * o link para onde o cliente deve ser redirecionado para digitar o cartão.
 * O cartão é preenchido na página do próprio Mercado Pago — nosso servidor
 * nunca recebe nem armazena número de cartão.
 */
export async function createMercadoPagoCheckout(params: {
  accessToken: string;
  orderPublicCode: string;
  items: PreferenceItem[];
  backUrl: string;
}) {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      items: params.items.map(item => ({
        title: item.title,
        quantity: item.quantity,
        currency_id: "BRL",
        unit_price: item.unit_price,
      })),
      external_reference: params.orderPublicCode,
      back_urls: {
        success: params.backUrl,
        pending: params.backUrl,
        failure: params.backUrl,
      },
      auto_return: "approved",
      // Confirmação automática de pagamento: o Mercado Pago chama essa URL
      // quando o status do pagamento muda. Só funciona se ENV.backendUrl for
      // um domínio público de verdade (não localhost) — em produção é.
      notification_url: `${ENV.backendUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago recusou a requisição (status ${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { init_point?: string; sandbox_init_point?: string };
  const redirectUrl = ENV.isProduction ? data.init_point : data.init_point ?? data.sandbox_init_point;
  if (!redirectUrl) throw new Error("Mercado Pago não retornou um link de pagamento.");
  return redirectUrl;
}

/**
 * Consulta o status real de um pagamento direto na API do Mercado Pago.
 * Nunca confiamos no corpo do webhook (qualquer um pode fazer POST nele) —
 * usamos só o ID que ele avisa e buscamos a verdade na própria API, com
 * nosso próprio access token. `external_reference` é o publicCode do pedido
 * (definido em createMercadoPagoCheckout).
 */
export async function getMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Mercado Pago recusou a consulta do pagamento (status ${response.status}).`);
  }
  const data = (await response.json()) as { id: number; status: string; external_reference?: string | null };
  return { id: data.id, status: data.status, externalReference: data.external_reference ?? null };
}

/**
 * Valida a assinatura do webhook (header `x-signature: ts=...,v1=...`),
 * seguindo exatamente o esquema documentado pelo Mercado Pago: HMAC-SHA256
 * sobre o template `id:{data.id};request-id:{x-request-id};ts:{ts};` (campo
 * omitido do template se ausente), usando a "chave secreta" de webhook
 * gerada em Central de vendedores → Webhooks → Configurar notificação — uma
 * chave diferente do access token (`apiKey`), guardada em `secretKey`.
 * Reutiliza o `crypto` nativo em vez de adicionar a dependência `mercadopago`
 * só por esse cálculo.
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
