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

/**
 * Novo cadastro vindo do site comercial (sem pagamento — a taxa de
 * implementação saiu do fluxo). Traz tudo que a pessoa preencheu e um link
 * direto de WhatsApp pro dono chamar. Os campos vêm de um formulário público
 * — sempre escapados.
 */
export function buildNewSignupMessage(params: {
  restaurantId: number;
  restaurantName: string;
  planName: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  // true = este e-mail/telefone já teve restaurante antes — o teste grátis NÃO foi concedido.
  repeatContact?: boolean;
}): string {
  const digits = params.contactPhone?.replace(/\D/g, "") ?? "";
  // Número brasileiro sem DDI (10–11 dígitos) ganha o 55; já com DDI fica como está.
  const waNumber = digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
  const lines = [
    "📩 <b>Novo cadastro no site</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `Plano: <b>${escapeHtml(params.planName)}</b>`,
    params.contactName?.trim() ? `Contato: ${escapeHtml(params.contactName.trim())}` : null,
    params.contactEmail ? `E-mail: ${escapeHtml(params.contactEmail)}` : null,
    params.contactPhone?.trim() ? `Telefone: ${escapeHtml(params.contactPhone.trim())}` : null,
    waNumber.length >= 10 ? `WhatsApp: https://wa.me/${waNumber}` : null,
    // A chave de API NUNCA vai pro Telegram (auditoria 2026-10-10): o histórico do chat
    // não é cifrado ponta a ponta e a chave é a credencial permanente do restaurante.
    `Chave de API: não é enviada por aqui (fica só em hash). Pra ver, rotacione em Painel Master → Restaurantes → #${params.restaurantId}.`,
    params.repeatContact ? "⚠️ <b>Contato repetido</b> — já teve restaurante antes, teste grátis de 7 dias NÃO foi concedido desta vez." : null,
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

/**
 * Provisionamento continua manual de propósito (decisão do dono,
 * 2026-09-29): automatizar de verdade exigiria dar ao container do
 * saas-core acesso ao socket do Docker (ou a uma peça nova de infra),
 * risco desproporcional pro volume atual (~1 cliente real). Esta mensagem
 * só entrega o comando PRONTO — a equipe cola na VPS e roda.
 */
export function buildProvisionCommandMessage(params: { restaurantId: number; restaurantName: string; command: string }): string {
  return [
    "🛠 <b>Provisionar ambiente novo</b>",
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    "Rode isto na VPS, dentro do repositório do sistema:",
    `<code>${escapeHtml(params.command)}</code>`,
    "Depois, cole a URL final em Restaurantes → este cliente → Editar, no Painel Master.",
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
    // A chave de API NUNCA vai pro Telegram (auditoria 2026-10-10): o histórico do chat
    // não é cifrado ponta a ponta e a chave é a credencial permanente do restaurante.
    `Chave de API: não é enviada por aqui (fica só em hash). Pra ver, rotacione em Painel Master → Restaurantes → #${params.restaurantId}.`,
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
    // Erro de query do Drizzle traz "params: <valores>" = dado de cliente (nome, e-mail, telefone).
    .replace(/(params:\s*)[^\n]*/gi, "$1[REDACTED]")
    // Chaves de restaurante (rk_live_...) e tokens de handoff do Modo Suporte (sup_...) nunca vão num alerta.
    .replace(/\b(rk_live_|sup_)[0-9a-f]{16,}/gi, "$1[REDACTED]")
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

function formatAlertTime(): string {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
}

/** User-Agent vem do navegador de quem tentou entrar — controlado por quem faz a requisição, então sempre escapado e truncado. */
function safeUserAgent(userAgent: string | undefined): string {
  return escapeHtml((userAgent ?? "desconhecido").slice(0, 120));
}

/**
 * Alerta a CADA login bem-sucedido no Painel Master. Login com código de
 * recuperação é sinalizado mais forte: é o caminho usado quando o celular com
 * o autenticador foi perdido — ou quando alguém roubou a lista de códigos.
 */
export function buildMasterLoginMessage(params: { email: string; ip: string; userAgent?: string; used2fa: boolean; usedRecoveryCode?: boolean }): string {
  const header = params.usedRecoveryCode
    ? "🚨 <b>Login no Painel Master com CÓDIGO DE RECUPERAÇÃO</b>"
    : "🔐 <b>Login no Painel Master</b>";
  return [
    header,
    `Conta: ${escapeHtml(params.email)}`,
    `IP: ${escapeHtml(params.ip)}`,
    `Dispositivo: ${safeUserAgent(params.userAgent)}`,
    `Verificação em 2 etapas: ${params.used2fa ? "sim" : "não (conta sem 2FA)"}`,
    ...(params.usedRecoveryCode ? ["⚠️ Um código de uso único foi gasto. Se não foi você: Segurança → Sair de todos os dispositivos e troque a senha."] : []),
    `Horário: ${escapeHtml(formatAlertTime())}`,
  ].join("\n");
}

/** Alerta quando alguém entra no deployment de um restaurante pelo Modo Suporte (chamado por masterPanel/support.ts). */
export function buildSupportEntryMessage(params: { adminEmail: string; restaurantName: string; restaurantId: number; ip: string }): string {
  return [
    "🛟 <b>Modo Suporte iniciado</b>",
    `Conta: ${escapeHtml(params.adminEmail)}`,
    `Restaurante: <b>${escapeHtml(params.restaurantName)}</b> (#${params.restaurantId})`,
    `IP: ${escapeHtml(params.ip)}`,
    `Horário: ${escapeHtml(formatAlertTime())}`,
  ].join("\n");
}

/** Muitas falhas de senha pro mesmo e-mail na última hora (o login NÃO é bloqueado por isso — só avisa). O e-mail é o que o atacante digitou: escapado. */
export function buildLoginFailuresMessage(params: { email: string; failures: number; ip: string }): string {
  return [
    "⚠️ <b>Falhas repetidas de login no Painel Master</b>",
    `E-mail tentado: ${escapeHtml(params.email.slice(0, 160))}`,
    `Falhas na última hora: ${params.failures}`,
    `Último IP: ${escapeHtml(params.ip)}`,
    `Horário: ${escapeHtml(formatAlertTime())}`,
  ].join("\n");
}

/** O 2FA de uma conta foi desligado pelo script de CLI (acesso ao servidor) — sempre vale um aviso. */
export function buildTotpResetCliMessage(params: { email: string }): string {
  return ["🔧 <b>2FA resetado por script no servidor</b>", `Conta: ${escapeHtml(params.email)}`, `Horário: ${escapeHtml(formatAlertTime())}`].join("\n");
}
