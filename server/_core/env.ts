function envBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export const ENV = {
  appId: process.env.APP_ID ?? "pubx",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:3000",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "pubx_session",
  cookieSecure: envBoolean(process.env.COOKIE_SECURE, process.env.NODE_ENV === "production"),
  primaryAdminOpenId: process.env.PRIMARY_ADMIN_OPEN_ID ?? "",
  bootstrapAdminName: process.env.BOOTSTRAP_ADMIN_NAME ?? "",
  bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME ?? "",
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "",
  isProduction: process.env.NODE_ENV === "production",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
  analyticsEndpoint: process.env.ANALYTICS_ENDPOINT ?? "",
  analyticsWebsiteId: process.env.ANALYTICS_WEBSITE_ID ?? "",
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? "587"),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "Pub X <noreply@example.com>",
  alertEmailTo: process.env.ALERT_EMAIL_TO ?? "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  trustProxy: process.env.TRUST_PROXY === "true",
  // Camada de licenciamento (SaaS) — em branco = desativada, sem mudar
  // nenhum comportamento existente (ver server/_core/license.ts).
  saasCoreUrl: process.env.SAAS_CORE_URL ?? "",
  saasCoreApiKey: process.env.SAAS_CORE_API_KEY ?? "",
  licenseSyncIntervalMs: Number(process.env.LICENSE_SYNC_INTERVAL_MS) || 5 * 60 * 1000,
  // Modo Suporte — em branco = recurso desligado (sem afetar login normal).
  supportSessionSecret: process.env.SUPPORT_SESSION_SECRET ?? "",
  // Envio de código por SMS (autoatendimento LGPD, ver server/_core/sms.ts) —
  // "none" (padrão) só registra o código no log do servidor, sem enviar de
  // verdade. "twilio" exige as três variáveis abaixo.
  smsProvider: process.env.SMS_PROVIDER ?? "none",
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  // Cifra o certificado digital A1 e o token CSC (NFC-e, ver server/db/fiscal.ts)
  // — em branco = a tela de configuração fiscal recusa salvar segredo
  // nenhum (mas dados cadastrais como CNPJ/regime continuam editáveis).
  fiscalEncryptionKey: process.env.FISCAL_ENCRYPTION_KEY ?? "",
};
