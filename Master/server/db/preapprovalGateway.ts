import { TRPCError } from "@trpc/server";
import { ENV } from "../_core/env";
import { getSubscriptionPreapproval, updateSubscriptionPreapproval } from "../_core/mercadoPagoBilling";

/**
 * Avisos ao Mercado Pago que PRECISAM dar certo antes de gravar a mudança
 * local (cancelar, pausar, retomar a cobrança). Concentrado aqui pra
 * restaurants.ts e subscriptions.ts não divergirem: se o Mercado Pago recusar,
 * quem chama não grava nada e o usuário recebe um erro claro em pt-BR.
 */
export type PreapprovalAction = "cancel" | "pause" | "resume";

const MP_STATUS = { cancel: "cancelled", pause: "paused", resume: "authorized" } as const;
const ACTION_NOUN = { cancel: "o cancelamento", pause: "a suspensão", resume: "a reativação" } as const;

/**
 * Cancela a preapproval, mas é idempotente: se o Mercado Pago já a mostra como
 * "cancelled" (ex.: cancelada na hora pelo cliente e agora finalizada no fim
 * do ciclo), não repete o PUT — uma preapproval cancelada é definitiva e o
 * PUT repetido poderia ser recusado e travar o fluxo. Se a consulta falhar,
 * tenta o cancelamento mesmo assim (melhor repetir do que deixar cobrando).
 */
export async function cancelPreapprovalIdempotent(preapprovalId: string): Promise<void> {
  const accessToken = ENV.mercadoPagoAccessToken;
  if (!accessToken) throw new Error("Credencial do Mercado Pago não configurada.");
  let state: { status?: string } | undefined;
  try {
    state = await getSubscriptionPreapproval(accessToken, preapprovalId);
  } catch {
    state = undefined; // consulta falhou: segue pro cancelamento
  }
  if (state?.status === "cancelled") return;
  await updateSubscriptionPreapproval({ accessToken, preapprovalId, status: "cancelled" });
}

/**
 * @param unchanged  frase "o que NÃO mudou" mostrada no erro (ex.: "O status do restaurante NÃO foi alterado")
 * @param retryHint  orientação final do erro; padrão é a do operador do Painel Master
 */
export async function applyGatewayPreapprovalAction(input: { preapprovalId: string; action: PreapprovalAction; unchanged: string; retryHint?: string }): Promise<void> {
  const noun = ACTION_NOUN[input.action];
  if (!ENV.mercadoPagoAccessToken) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Não foi possível avisar o Mercado Pago (credencial não configurada). ${input.unchanged}.` });
  }
  try {
    if (input.action === "cancel") await cancelPreapprovalIdempotent(input.preapprovalId);
    else await updateSubscriptionPreapproval({ accessToken: ENV.mercadoPagoAccessToken, preapprovalId: input.preapprovalId, status: MP_STATUS[input.action] });
  } catch (error) {
    console.error(`[preapprovalGateway] Mercado Pago recusou ${noun} da assinatura:`, error instanceof Error ? error.message : error);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `O Mercado Pago não aceitou ${noun} da cobrança. ${input.unchanged}; ${input.retryHint ?? "tente de novo em instantes ou ajuste direto no Mercado Pago"}.`,
    });
  }
}
