import { ENV } from "./env";

/**
 * Chamadas de escrita pro saas-core relacionadas à assinatura do PRÓPRIO
 * restaurante (self-service — troca de plano/cancelamento/reativação),
 * autenticadas com a mesma API key já usada pro sync de licença
 * (server/_core/license.ts). Arquivo separado de license.ts de propósito:
 * lá é sincronização somente-leitura em background; aqui são mutações
 * disparadas por uma ação explícita do admin no painel.
 */

function baseHeaders() {
  return { Authorization: `Bearer ${ENV.saasCoreApiKey}`, "Content-Type": "application/json" };
}

async function postToSaasCore<T>(path: string, input: unknown): Promise<T> {
  if (!ENV.saasCoreUrl || !ENV.saasCoreApiKey) throw new Error("Camada de licenciamento (SaaS) não está configurada.");
  const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/${path}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `saas-core respondeu ${response.status}`);
  }
  const body = (await response.json()) as { result: { data: T } };
  return body.result.data;
}

async function getFromSaasCore<T>(path: string): Promise<T> {
  if (!ENV.saasCoreUrl || !ENV.saasCoreApiKey) throw new Error("Camada de licenciamento (SaaS) não está configurada.");
  const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/${path}`, { headers: baseHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || `saas-core respondeu ${response.status}`);
  }
  const body = (await response.json()) as { result: { data: T } };
  return body.result.data;
}

export type ChangePlanResult = { checkoutUrl: string } | { scheduled: true; effectiveAt: number; planKey: string } | { applied: true };

export async function changeSubscriptionPlan(planKey: string, payerEmail: string, deviceId?: string): Promise<ChangePlanResult> {
  const backUrl = `${ENV.frontendUrl.replace(/\/+$/, "")}/admin/plano`;
  return postToSaasCore<ChangePlanResult>("billing.changePlan", { planKey, payerEmail, backUrl, deviceId });
}

export async function cancelSubscription(reason?: string): Promise<{ effectiveAt: number }> {
  return postToSaasCore("billing.cancelSubscription", { reason });
}

export async function reactivateSubscription(): Promise<{ success: true }> {
  return postToSaasCore("billing.reactivateSubscription", undefined);
}

export type BillingPaymentEntry = { id: number; gateway: string; gatewayPaymentId: string | null; amountCents: number; status: "pending" | "paid" | "failed" | "refunded"; paidAt: number | null; createdAt: number };

export async function getBillingPaymentHistory(): Promise<BillingPaymentEntry[]> {
  return getFromSaasCore<BillingPaymentEntry[]>("billing.paymentHistory");
}
