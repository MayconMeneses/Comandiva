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

// Evita inundar o Telegram com alertas repetidos — no máximo 1 alerta por
// `kind` a cada 10min (mesmo raciocínio de server/_core/alerts.ts no app
// principal). Por `kind` (não uma janela única global) pra um crash-loop de
// erro interno numa requisição não "consumir" a janela e esconder um
// uncaughtException real logo em seguida, ou vice-versa.
const lastAlertAtByKind = new Map<string, number>();
const ALERT_THROTTLE_MS = 10 * 60 * 1000;

/** Ponto único de alerta de malfuncionamento (crash do processo ou erro interno numa requisição) — sempre pelo Telegram, nunca bloqueia quem chamou. */
export function alertSystemError(subject: string, detail: string, kind: string, area?: string): Promise<void> {
  const now = Date.now();
  const lastAlertAt = lastAlertAtByKind.get(kind) ?? 0;
  if (now - lastAlertAt < ALERT_THROTTLE_MS) return Promise.resolve();
  lastAlertAtByKind.set(kind, now);
  return sendTelegramMessage(buildSystemErrorMessage({ subject, detail, area }))
    .then(outcome => {
      if (!outcome.sent) console.error("[telegram] Falha ao mandar alerta de erro:", outcome.reason);
    })
    .catch(error => console.error("[telegram] Erro inesperado ao mandar alerta de erro:", error));
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

export function buildMenuReferenceCaption(params: { restaurantId: number; restaurantName: string; notes?: string }): string {
  const base = `📎 <b>Cardápio enviado pelo cliente</b>\nRestaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`;
  const trimmedNotes = params.notes?.trim();
  return trimmedNotes ? `${base}\n\n💬 <b>Observações do cliente:</b>\n${escapeHtml(trimmedNotes)}` : base;
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
  // true = este e-mail/telefone já teve restaurante antes — trial de 7
  // dias NÃO foi concedido (ver hasRestaurantForContact/achado da auditoria
  // de segurança). Sinalizado aqui pra nunca ficar invisível: um bloqueio
  // automático que ninguém vê pode esconder um falso positivo (duas pessoas
  // diferentes que só compartilham telefone, por exemplo).
  repeatContact?: boolean;
}): string {
  const amount = (params.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return [
    "🎉 <b>Novo cliente pago</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Plano: ${escapeHtml(params.planName)}`,
    `Contato: ${escapeHtml(params.contactName || "-")} · ${escapeHtml(params.contactEmail)}${params.contactPhone ? ` · ${escapeHtml(params.contactPhone)}` : ""}`,
    `Taxa de implementação paga: ${amount}`,
    `API key: <code>${escapeHtml(params.apiKey)}</code>`,
    ...(params.repeatContact ? ["⚠️ <b>Contato repetido</b> — já teve restaurante antes, teste grátis de 7 dias NÃO foi concedido desta vez."] : []),
  ].join("\n");
}

export function buildRestaurantDeliveredMessage(params: { restaurantId: number; restaurantName: string; trialEndsAt: number }): string {
  const trialEndsAtLabel = new Date(params.trialEndsAt).toLocaleDateString("pt-BR");
  return [
    "✅ <b>Ambiente entregue</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Teste grátis de 7 dias começou a valer — termina em ${trialEndsAtLabel}.`,
  ].join("\n");
}

export function buildSubscriptionRenewedMessage(params: { restaurantId: number; restaurantName: string; amountCents: number }): string {
  const amount = (params.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return ["✅ <b>Mensalidade renovada</b>", `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`, `Valor: ${amount}`].join("\n");
}

export function buildSubscriptionPastDueMessage(params: { restaurantId: number; restaurantName: string }): string {
  return [
    "🟡 <b>Pagamento da mensalidade não passou</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    "O Mercado Pago vai tentar cobrar de novo automaticamente nos próximos dias.",
    "Se não resolver em 5 dias, o acesso do cliente é bloqueado automaticamente.",
  ].join("\n");
}

export function buildSubscriptionRecoveredMessage(params: { restaurantId: number; restaurantName: string }): string {
  return ["✅ <b>Pagamento recuperado</b>", `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`, "A cobrança passou e o acesso continua normal."].join("\n");
}

export function buildSubscriptionPastDueGraceExpiredMessage(params: { restaurantId: number; restaurantName: string }): string {
  return [
    "🔴 <b>Acesso bloqueado por falta de pagamento</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    "Passaram 5 dias sem a cobrança da mensalidade ser confirmada — acesso bloqueado até regularizar.",
  ].join("\n");
}

export function buildSubscriptionCanceledMessage(params: { restaurantId: number; restaurantName: string }): string {
  return ["🔴 <b>Assinatura cancelada</b>", `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`, "O Mercado Pago cancelou a assinatura recorrente deste cliente."].join("\n");
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

/**
 * Acha "server/pasta/arquivo.ts:linha" na primeira linha do stack trace que
 * não é do node_modules — é o que deixa quem recebe o alerta ir direto no
 * código, em vez de só ver a mensagem crua do erro (mesmo raciocínio de
 * server/_core/alerts.ts no app principal).
 */
function extractSourceLocation(text: string): string | undefined {
  for (const line of text.split("\n")) {
    if (line.includes("node_modules")) continue;
    const match = line.match(/((?:server|shared|client)[\\/][^\s():]+):(\d+):\d+/);
    if (match) return `${match[1]!.replace(/\\/g, "/")}:${match[2]}`;
  }
  return undefined;
}

/**
 * `area` identifica QUAL parte do saas-core (o mesmo processo hospeda o
 * Painel Master, o site comercial de cadastro e a API interna/operador) —
 * ver server/_core/trpc.ts::describeArea, que deriva isso do namespace tRPC.
 * Omitido pros crashes de processo inteiro (uncaughtException/unhandledRejection),
 * que não têm uma área específica — o processo caiu todo.
 */
export function buildSystemErrorMessage(params: { subject: string; detail: string; area?: string }): string {
  const environment = ENV.isProduction ? "Produção" : "Desenvolvimento";
  const horario = new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
  const location = extractSourceLocation(params.detail);
  const safeDetail = redactSecrets(params.detail).slice(0, MAX_ERROR_MESSAGE_LENGTH);
  return [
    "🔴 <b>Erro grave no saas-core</b>",
    `Ambiente: ${escapeHtml(environment)}`,
    ...(params.area ? [`Área: ${escapeHtml(params.area)}`] : []),
    `Evento: ${escapeHtml(params.subject)}`,
    ...(location ? [`Local: ${escapeHtml(location)}`] : []),
    "",
    `<pre>${escapeHtml(safeDetail)}</pre>`,
    "",
    `Horário: ${escapeHtml(horario)}`,
  ].join("\n");
}
