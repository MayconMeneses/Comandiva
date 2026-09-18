import { ENV } from "./env";

export type SendTelegramOutcome = { sent: true } | { sent: false; reason: string };

/**
 * Ponto único de notificação operacional pro dono da plataforma (novo
 * cliente pago, restaurante entregue) — nunca e-mail pro cliente, isso é
 * emailService.ts. Em branco = desligado, só loga e segue (mesma regra do
 * emailService.ts: uma falha de notificação nunca pode desfazer ou bloquear
 * a ação de negócio que disparou o envio).
 */
export async function sendTelegramMessage(text: string): Promise<SendTelegramOutcome> {
  if (!ENV.telegramBotToken || !ENV.telegramChatId) {
    console.log(`[telegram] (não configurado) ${text.slice(0, 120)}`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ENV.telegramChatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: `Telegram recusou o envio (status ${response.status}): ${detail.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Falha de rede ao chamar o Telegram." };
  }
}

/**
 * Fogo-e-esquece pro caminho crítico (webhook de pagamento, entrega do
 * restaurante) — nunca `await` isto ali, mesmo raciocínio de sendEmailAsync
 * em emailService.ts: notificação nunca pode segurar a resposta nem
 * derrubar o fluxo principal.
 */
export function sendTelegramMessageAsync(text: string): void {
  void sendTelegramMessage(text).catch(error => console.error("[telegram] Erro inesperado ao enviar mensagem:", error));
}

/** `parse_mode: "HTML"` do Telegram — nome de restaurante/contato vem de quem preenche o formulário público, nunca confiar sem escapar. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Manda um arquivo (cardápio enviado pelo cliente) direto pro chat do dono,
 * como anexo de apoio pra ele organizar a configuração na mão — o arquivo
 * NUNCA é salvo no banco nem em storage próprio do saas-core (ver comentário
 * em drizzle/schema/restaurants.ts: cardápio/pedidos/clientes do restaurante
 * ficam 100% no deployment próprio de cada um, nunca aqui).
 */
export async function sendTelegramDocument(params: { fileBuffer: Buffer; fileName: string; mimeType: string; caption: string }): Promise<SendTelegramOutcome> {
  if (!ENV.telegramBotToken || !ENV.telegramChatId) {
    console.log(`[telegram] (não configurado) documento "${params.fileName}" — ${params.caption.slice(0, 120)}`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const form = new FormData();
    form.append("chat_id", ENV.telegramChatId);
    form.append("caption", params.caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([new Uint8Array(params.fileBuffer)], { type: params.mimeType }), params.fileName);

    const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendDocument`, { method: "POST", body: form });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: `Telegram recusou o envio (status ${response.status}): ${detail.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : "Falha de rede ao chamar o Telegram." };
  }
}

export function sendTelegramDocumentAsync(params: { fileBuffer: Buffer; fileName: string; mimeType: string; caption: string }): void {
  void sendTelegramDocument(params).catch(error => console.error("[telegram] Erro inesperado ao enviar documento:", error));
}

export function buildMenuReferenceCaption(params: { restaurantId: number; restaurantName: string }): string {
  return `📎 <b>Cardápio enviado pelo cliente</b>\nRestaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`;
}

export function buildEnvironmentProvisionedMessage(params: {
  restaurantId: number;
  restaurantName: string;
  url: string;
  adminUsername: string;
  adminPassword: string;
}): string {
  return [
    "🚀 <b>Ambiente técnico provisionado</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `URL: ${escapeHtml(params.url)}`,
    `Login admin: <code>${escapeHtml(params.adminUsername)}</code> / <code>${escapeHtml(params.adminPassword)}</code>`,
    "Agora é organizar o cardápio e marcar como entregue quando terminar.",
  ].join("\n");
}

export function buildEnvironmentProvisioningFailedMessage(params: { restaurantId: number; restaurantName: string; error: string }): string {
  return [
    "⚠️ <b>Falha ao provisionar ambiente automaticamente</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Erro: ${escapeHtml(params.error.slice(0, 400))}`,
    "Precisa subir o ambiente na mão pra este cliente.",
  ].join("\n");
}

export function buildNewPaidSignupMessage(params: {
  restaurantId: number;
  restaurantName: string;
  planName: string;
  contactName?: string;
  contactEmail: string;
  contactPhone?: string;
  amountCents: number;
  apiKey: string;
}): string {
  const amount = (params.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return [
    "🎉 <b>Novo cliente pago</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Plano: ${escapeHtml(params.planName)}`,
    `Contato: ${escapeHtml(params.contactName || "-")} · ${escapeHtml(params.contactEmail)}${params.contactPhone ? ` · ${escapeHtml(params.contactPhone)}` : ""}`,
    `Taxa de implementação paga: ${amount}`,
    `API key: <code>${escapeHtml(params.apiKey)}</code>`,
  ].join("\n");
}

export function buildRestaurantDeliveredMessage(params: { restaurantId: number; restaurantName: string; trialEndsAt: number }): string {
  const trialEndsAtLabel = new Date(params.trialEndsAt).toLocaleDateString("pt-BR");
  return [
    "✅ <b>Ambiente entregue</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Teste grátis de 30 dias começou a valer — termina em ${trialEndsAtLabel}.`,
  ].join("\n");
}

/**
 * Nunca mandar segredo por engano num alerta — o texto normalmente vem de
 * stack trace/mensagem de erro interna, não de entrada de usuário, mas
 * aplicamos essa rede de segurança mesmo assim (mesmo raciocínio de
 * server/_core/alerts.ts no app principal).
 */
function redactSecrets(text: string): string {
  return text
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|secret|password|senha|token)["'\s:=]+)[^\s"']{4,}/gi, "$1[REDACTED]");
}

const MAX_ERROR_MESSAGE_LENGTH = 3500; // Telegram limita a 4096 caracteres; deixa folga pro resto do texto.

export function buildSystemErrorMessage(params: { subject: string; detail: string }): string {
  const environment = ENV.isProduction ? "Produção" : "Desenvolvimento";
  const horario = new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
  const safeDetail = redactSecrets(params.detail).slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return [
    "🔴 <b>Erro grave no saas-core</b>",
    `Ambiente: ${escapeHtml(environment)}`,
    `Evento: ${escapeHtml(params.subject)}`,
    "",
    `<pre>${escapeHtml(safeDetail)}</pre>`,
    "",
    `Horário: ${escapeHtml(horario)}`,
  ].join("\n");
}
