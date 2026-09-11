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
  idempotencyKey: string;
}) {
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.idempotencyKey,
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
 * Cria uma cobrança Pix de verdade via Payments API (`POST /v1/payments` com
 * `payment_method_id: "pix"`) — documentação oficial:
 * https://www.mercadopago.com.br/developers/en/docs/checkout-api-payments/integration-configuration/integrate-pix
 * Diferente do Checkout Pro (preferências), aqui o Mercado Pago exige CPF do
 * pagador (`payer.identification`) mesmo pra Pix. `X-Idempotency-Key` evita
 * que um retry de rede (nosso ou do cliente HTTP) gere uma segunda cobrança
 * pro mesmo pedido — vem pronta de quem chama (params.idempotencyKey), não é
 * construída aqui: precisa variar por TENTATIVA de cobrança, não só por
 * pedido, senão regenerar um Pix depois que o anterior venceu devolve a
 * cobrança antiga (já vencida de verdade) em vez de criar uma nova.
 */
export async function createMercadoPagoPixPayment(params: {
  accessToken: string;
  orderPublicCode: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  payerCpf: string;
  notificationUrl: string;
  expiresInMinutes: number;
  idempotencyKey: string;
}) {
  const expiresAt = Date.now() + params.expiresInMinutes * 60_000;
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: Math.round(params.amountCents) / 100,
      payment_method_id: "pix",
      description: params.description,
      external_reference: params.orderPublicCode,
      notification_url: params.notificationUrl,
      date_of_expiration: new Date(expiresAt).toISOString(),
      payer: {
        email: params.payerEmail,
        identification: { type: "CPF", number: params.payerCpf.replace(/\D/g, "") },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mercado Pago recusou a criação do Pix (status ${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    id: number;
    status: string;
    point_of_interaction?: { transaction_data?: { qr_code?: string } };
  };
  const pixCopyPaste = data.point_of_interaction?.transaction_data?.qr_code;
  if (!pixCopyPaste) throw new Error("Mercado Pago não retornou o código Pix.");
  return { providerPaymentId: String(data.id), status: data.status, pixCopyPaste, expiresAt };
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
  const data = (await response.json()) as { id: number; status: string; status_detail?: string | null; external_reference?: string | null };
  return { id: data.id, status: data.status, statusDetail: data.status_detail ?? null, externalReference: data.external_reference ?? null };
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
