import { sendViaResend } from "./emailProviderResend";
import { EMAIL_TEMPLATES, type EmailTemplateId } from "./emailTemplates";
import { ENV } from "./env";

type VarsFor<T extends EmailTemplateId> = Parameters<(typeof EMAIL_TEMPLATES)[T]["render"]>[0];

export type SendEmailOutcome = { sent: true; providerMessageId: string } | { sent: false; reason: string };

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ponto único de envio de e-mail transacional — todo o resto do sistema
 * chama SÓ isto, nunca o provedor direto (ver regra #20 do prompt do dono:
 * trocar de Resend pra outro provedor no futuro deve significar mexer só
 * em emailProviderResend.ts, nada mais). NUNCA lança exceção — o chamador
 * sempre recebe um resultado, nunca precisa de try/catch, porque uma falha
 * de e-mail jamais pode desfazer ou bloquear a ação de negócio que disparou
 * o envio (pagamento aprovado, assinatura atualizada etc. — regra #30).
 *
 * Retry limitado e em memória (3 tentativas, sem fila/persistência ainda —
 * decisão deliberada: a tabela de log/retry persistente fica pra quando
 * puder ser adicionada sem risco de colidir com uma migration de schema já
 * em andamento no mesmo serviço). Uma falha definitiva só é registrada via
 * console.error, mesmo padrão já usado em server/_core/mercadoPagoBilling.ts
 * pra erros que não podem derrubar o fluxo principal.
 */
export async function sendEmail<T extends EmailTemplateId>(to: string, template: T, vars: VarsFor<T>): Promise<SendEmailOutcome> {
  const definition = EMAIL_TEMPLATES[template];
  const subject = definition.subject(vars as never);
  const html = definition.render(vars as never);

  // Fora de produção, nunca manda pro destinatário real — redireciona pra
  // um destinatário de teste se configurado, ou só loga (ver regra #37).
  const recipient = ENV.isProduction ? to : ENV.emailDevRecipient;
  if (!recipient) {
    console.log(`[email] (dev, sem EMAIL_DEV_RECIPIENT) ${template} → ${to}: "${subject}"`);
    return { sent: false, reason: "dev-mode-no-recipient" };
  }

  let lastError = "desconhecido";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await sendViaResend({ to: recipient, subject, html });
    if (result.success) return { sent: true, providerMessageId: result.providerMessageId };
    lastError = result.error;
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }
  console.error(`[email] Falha definitiva após ${MAX_ATTEMPTS} tentativas — template=${template} to=${to}: ${lastError}`);
  return { sent: false, reason: lastError };
}

/**
 * Fogo-e-esquece pro caminho crítico (webhook de pagamento, mutation de
 * assinatura) — nunca `await` isto ali, exatamente pra não segurar a
 * resposta esperando o provedor de e-mail (regra #38). O retry/log de erro
 * já acontece dentro de sendEmail(); aqui só garante que uma promise
 * rejeitada não vira um unhandledRejection (sendEmail já não lança, mas
 * mantém a mesma defesa que o resto do projeto usa em disparos assíncronos).
 */
export function sendEmailAsync<T extends EmailTemplateId>(to: string, template: T, vars: VarsFor<T>): void {
  void sendEmail(to, template, vars).catch(error => console.error(`[email] Erro inesperado ao enviar ${template}:`, error));
}
