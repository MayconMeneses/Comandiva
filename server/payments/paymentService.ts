import { eq } from "drizzle-orm";
import { paymentGateways } from "../../drizzle/schema";
import { getDb, markOrderPaymentFailedByPublicCode, markOrderPaymentPaidByPublicCode } from "../db";
import { emitNfceForOrder } from "../_core/nfceEmission";
import { markWebhookEventOnce } from "./repositories/webhookEvents";
import { mercadoPagoProvider } from "./providers/mercadoPago";
import type { PaymentProvider } from "./types";

/**
 * Ponto único de registro de gateway — adicionar um novo provider é
 * acrescentar uma linha aqui (mais o arquivo em providers/), sem tocar em
 * checkout, webhook ou banco. O checkout nunca conhece MercadoPagoAdapter
 * etc. diretamente, só fala com PaymentService/PaymentProvider.
 */
const PROVIDERS: Record<string, PaymentProvider> = {
  MERCADO_PAGO: mercadoPagoProvider,
};

export type ActiveGateway = { id: number; provider: string; label: string; apiKey: string; secretKey: string | null };

/** Gateway ativo cadastrado (Admin → Conta) + o adapter correspondente, prontos pra uso. Lança erro amigável (nunca técnico) quando não há nada configurado ou o provider ainda não tem adapter implementado. */
export async function getActiveGatewayAndProvider(): Promise<{ gateway: ActiveGateway; provider: PaymentProvider }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [gateway] = await db.select().from(paymentGateways).where(eq(paymentGateways.active, true)).limit(1);
  if (!gateway || !gateway.apiKey) {
    throw new PaymentConfigError("Pagamento online não está configurado no momento. Escolha outra forma de pagamento.");
  }
  const provider = PROVIDERS[gateway.provider];
  if (!provider) {
    throw new PaymentConfigError(`A cobrança automática para ${gateway.label} ainda não foi conectada. Escolha outra forma de pagamento ou fale com o restaurante.`);
  }
  return { gateway: { id: gateway.id, provider: gateway.provider, label: gateway.label, apiKey: gateway.apiKey, secretKey: gateway.secretKey }, provider };
}

/** Erro de configuração de gateway — sempre com mensagem já pronta pra mostrar ao cliente final (nunca vaza detalhe técnico). */
export class PaymentConfigError extends Error {}

/**
 * Aplica uma notificação de pagamento já validada e re-consultada na API do
 * gateway (nunca confiar no corpo do webhook em si — isso é responsabilidade
 * de quem chama, ver server/payments/webhooks/mercadopago.ts). Idempotente:
 * a mesma notificação (mesmo id + mesmo status) processada duas vezes não
 * duplica nenhum efeito — a chave inclui o status, não só o id do pagamento,
 * porque o mesmo id do gateway gera notificações diferentes em cada mudança
 * de estado (pending→approved→refunded), e sem o status na chave a segunda
 * notificação de verdade seria descartada como se fosse duplicata da primeira.
 *
 * Marcar "já processado" e aplicar o efeito (pagar/falhar o pedido) rodam
 * dentro da MESMA transação de banco, de propósito: se o UPDATE do pedido
 * falhar por qualquer motivo (erro transitório de conexão, deadlock), o
 * registro de idempotência também é desfeito junto — sem isso, uma falha
 * nessa janela deixava a notificação marcada como "processada" pra sempre
 * sem o efeito real ter acontecido, e nem o reenvio automático do Mercado
 * Pago nem um reenvio manual pelo painel dele conseguiam corrigir depois
 * (os dois bateriam na mesma chave, já vista, e seriam descartados).
 */
export async function applyPaymentStatusNotification(params: {
  gatewayName: string;
  providerPaymentId: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | "EXPIRED";
  externalReference: string | null;
}): Promise<{ applied: boolean }> {
  if (!params.externalReference) return { applied: false };
  // PENDING/qualquer status sem tradução não exige nenhuma escrita — o
  // pagamento já nasce PENDING (default do schema).
  if (params.status === "PENDING") return { applied: false };
  const externalReference = params.externalReference;
  const status = params.status;

  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const eventKey = `payment:${params.providerPaymentId}:${status}`;
  let applied = false;
  let paidOrderId: number | undefined;
  await db.transaction(async tx => {
    const { alreadyProcessed } = await markWebhookEventOnce(params.gatewayName, eventKey, tx);
    if (alreadyProcessed) return;

    const result =
      status === "PAID"
        ? await markOrderPaymentPaidByPublicCode(externalReference, params.providerPaymentId, tx)
        : await markOrderPaymentFailedByPublicCode(externalReference, params.providerPaymentId, status, tx);

    if (!result.found) {
      // externalReference não bate com nenhum pedido — não é falha de banco
      // (não deve refazer a transação nem o Mercado Pago reenviar), só um
      // dado inesperado do gateway. Registra pra investigação manual em vez
      // de reportar sucesso como se o efeito tivesse sido aplicado.
      console.warn(`[payments] Notificação de ${params.gatewayName} referenciando pedido inexistente (publicCode: ${externalReference}).`);
      return;
    }
    applied = true;
    if (status === "PAID") paidOrderId = result.orderId;
  });
  // Fora da transação de propósito: emissão de NFC-e é uma chamada de rede
  // externa (Focus NFe) — nunca deve segurar um lock de banco esperando ela
  // responder. Pix/cartão online é o único dos 3 pontos de emissão (ver
  // "Quando emitir" no plano de NFC-e) que passa pelo pagamento em si; os
  // outros dois (dinheiro/cartão na entrega, mesa) disparam em outro lugar.
  if (paidOrderId !== undefined) void emitNfceForOrder(paidOrderId).catch(error => console.warn("[nfce] Falha ao emitir NFC-e após confirmação de pagamento:", error));
  return { applied };
}
