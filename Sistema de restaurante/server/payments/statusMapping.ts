import type { InternalPaymentStatus } from "./types";

/**
 * Traduz status+status_detail do Mercado Pago pro vocabulário interno —
 * único lugar do sistema que conhece o vocabulário específico do MP. Um Pix
 * vencido sem pagamento vira `status: "cancelled"` + `status_detail:
 * "expired"` (confirmado na documentação oficial de cancelamentos); sem
 * checar o status_detail, isso ficaria indistinguível de um cancelamento de
 * verdade. "pending"/"in_process"/"authorized" não geram ação — o pagamento
 * já nasce PENDING (default do schema) e continua assim até a próxima notificação.
 */
export function mapMercadoPagoStatus(status: string, statusDetail?: string | null): InternalPaymentStatus | null {
  if (status === "approved") return "PAID";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  if (status === "cancelled" || status === "rejected") {
    return statusDetail === "expired" ? "EXPIRED" : "CANCELLED";
  }
  return null;
}
