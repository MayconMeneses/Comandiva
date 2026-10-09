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
  smtpFrom: process.env.SMTP_FROM ?? "Comandiva <noreply@example.com>",
  alertEmailTo: process.env.ALERT_EMAIL_TO ?? "",
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
  trustProxy: process.env.TRUST_PROXY === "true",
};
