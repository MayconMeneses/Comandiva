import nodemailer from "nodemailer";
import { ENV } from "./env";

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (!ENV.smtpHost || !ENV.smtpUser || !ENV.smtpPassword) return null;
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpPort === 465,
      auth: { user: ENV.smtpUser, pass: ENV.smtpPassword },
    });
  }
  return cachedTransport;
}

// Evita inundar o dono com alertas repetidos: no máximo 1 alerta do mesmo
// tipo a cada 10 minutos, em qualquer canal (e-mail, webhook ou Telegram).
const lastSentAt = new Map<string, number>();
const THROTTLE_MS = 10 * 60 * 1000;

type AlertSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
const SEVERITY_EMOJI: Record<AlertSeverity, string> = { INFO: "🟢", WARNING: "🟡", ERROR: "🟠", CRITICAL: "🔴" };
// Os únicos tipos de alerta que existem hoje no sistema são erro não tratado
// no servidor e o botão de teste do admin — mapeamento simples, sem exigir
// que cada chamada informe a severidade manualmente.
const DEFAULT_SEVERITY_BY_KIND: Record<string, AlertSeverity> = { test: "INFO", uncaughtException: "CRITICAL", unhandledRejection: "CRITICAL" };

const MAX_MESSAGE_LENGTH = 3500; // Telegram limita mensagens a 4096 caracteres; deixa folga pro resto do texto.

/**
 * Nunca enviar segredos por engano num alerta — o texto normalmente vem de
 * stack traces/mensagens de erro internas, não de entrada de usuário, mas
 * aplicamos uma rede de segurança mesmo assim.
 */
function redactSecrets(text: string): string {
  return text
    .replace(/(Bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|secret|password|senha|token)["'\s:=]+)[^\s"']{4,}/gi, "$1[REDACTED]");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n… (truncado)` : text;
}

function formatAlert(subject: string, message: string, severity: AlertSeverity, now: number) {
  const emoji = SEVERITY_EMOJI[severity];
  const environment = ENV.isProduction ? "Produção" : "Desenvolvimento";
  const horario = new Date(now).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
  const safeMessage = truncate(redactSecrets(message), MAX_MESSAGE_LENGTH);
  return {
    subject: `[Pub X] ${subject}`,
    text: `${emoji} ${severity}\nSistema: Pub X\nAmbiente: ${environment}\nEvento: ${subject}\n\n${safeMessage}\n\nHorário: ${horario}`,
  };
}

async function sendTelegramAlert(text: string) {
  if (!ENV.telegramBotToken || !ENV.telegramChatId) return;
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: ENV.telegramChatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram recusou o envio (status ${response.status}): ${detail.slice(0, 300)}`);
  }
}

/**
 * Envia um alerta para o dono do site quando algo crítico acontece (erro não
 * tratado no servidor, falha de conexão com o banco, etc). Configurado via
 * variáveis SMTP + ALERT_EMAIL_TO, ALERT_WEBHOOK_URL e/ou TELEGRAM_BOT_TOKEN
 * + TELEGRAM_CHAT_ID no .env — os três canais são independentes e opcionais;
 * quantos estiverem configurados recebem o alerta. Se nenhum estiver
 * configurado, só registra no log. Uma falha ao enviar (ex.: Telegram fora
 * do ar) nunca derruba a aplicação nem impede os outros canais de tentar.
 */
export async function sendOwnerAlert(subject: string, message: string, kind = "generic", severity?: AlertSeverity) {
  const now = Date.now();
  const last = lastSentAt.get(kind) ?? 0;
  if (now - last < THROTTLE_MS) return;
  lastSentAt.set(kind, now);

  const resolvedSeverity = severity ?? DEFAULT_SEVERITY_BY_KIND[kind] ?? "ERROR";
  const { subject: fullSubject, text } = formatAlert(subject, message, resolvedSeverity, now);

  try {
    const transport = getTransport();
    if (transport && ENV.alertEmailTo) {
      await transport.sendMail({ from: ENV.smtpFrom, to: ENV.alertEmailTo, subject: fullSubject, text });
    } else {
      console.warn("[alerts] SMTP/ALERT_EMAIL_TO não configurado — alerta não enviado por e-mail:", fullSubject);
    }
  } catch (error) {
    console.error("[alerts] Falha ao enviar e-mail de alerta:", error);
  }

  if (ENV.alertWebhookUrl) {
    try {
      await fetch(ENV.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: fullSubject, message: text, kind, severity: resolvedSeverity }),
      });
    } catch (error) {
      console.error("[alerts] Falha ao enviar webhook de alerta:", error);
    }
  }

  if (ENV.telegramBotToken && ENV.telegramChatId) {
    try {
      await sendTelegramAlert(text);
    } catch (error) {
      console.error("[alerts] Falha ao enviar alerta pelo Telegram:", error);
    }
  } else {
    console.warn("[alerts] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados — alerta não enviado pelo Telegram:", fullSubject);
  }
}
