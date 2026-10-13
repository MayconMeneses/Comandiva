import { ENV } from "./env";

/**
 * Adaptador do Resend via `fetch` cru (mesmo estilo já usado pro Mercado
 * Pago em mercadoPagoBilling.ts/mercadoPagoCheckout.ts) — sem instalar o SDK
 * oficial, pra não trazer mais uma dependência pra um POST simples e manter
 * o comportamento inteiramente auditável. Trocar de provedor (ex.: Brevo)
 * no futuro significa escrever um outro arquivo com essa mesma forma
 * (SendEmailResult) e trocar a implementação usada em emailService.ts —
 * nada além disso muda.
 */

export type SendEmailResult = { success: true; providerMessageId: string } | { success: false; error: string };

export async function sendViaResend(params: { to: string; subject: string; html: string }): Promise<SendEmailResult> {
  if (!ENV.resendApiKey || !ENV.emailFrom) {
    return { success: false, error: "RESEND_API_KEY/EMAIL_FROM não configurados" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.resendApiKey}` },
      body: JSON.stringify({
        from: `${ENV.emailFromName} <${ENV.emailFrom}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { success: false, error: `Resend recusou o envio (status ${response.status}): ${detail.slice(0, 300)}` };
    }
    const data = (await response.json()) as { id?: string };
    if (!data.id) return { success: false, error: "Resend não retornou um id de mensagem." };
    return { success: true, providerMessageId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Falha de rede ao chamar o Resend." };
  }
}
