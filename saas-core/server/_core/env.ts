export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  // Protege os endpoints de operador (criar/listar restaurante, atribuir
  // plano) — só quem opera a plataforma tem esse token, nunca um restaurante.
  operatorToken: process.env.OPERATOR_TOKEN ?? "",
  isProduction: process.env.NODE_ENV === "production",
  trustProxy: process.env.TRUST_PROXY === "true",
  // Painel Master (Super Admin) — autenticação própria, nada a ver com
  // operatorToken (scripts/CLI) nem com a API key de restaurante.
  platformJwtSecret: process.env.PLATFORM_JWT_SECRET ?? "",
  platformSessionCookieName: process.env.PLATFORM_SESSION_COOKIE_NAME ?? "platform_session",
  bootstrapSuperadminName: process.env.BOOTSTRAP_SUPERADMIN_NAME ?? "",
  bootstrapSuperadminEmail: process.env.BOOTSTRAP_SUPERADMIN_EMAIL ?? "",
  bootstrapSuperadminPassword: process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ?? "",
  // Modo Suporte — duração do token de handoff (não é segredo, sem boot-check).
  supportSessionTtlMs: Number(process.env.SUPPORT_SESSION_TTL_MS) || 15 * 60 * 1000,
  // Cobrança da mensalidade do próprio SaaS (o restaurante-cliente pagando a
  // plataforma) — conta do Mercado Pago da PLATAFORMA, nunca a de nenhum
  // restaurante-cliente (essa é configurada por cada um, dentro do próprio
  // deployment). Em branco = cobrança automática desligada, sem afetar nada.
  mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "",
  mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "",
};
