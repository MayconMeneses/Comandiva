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
  // `||` (não `??`) de propósito — um .env com a variável presente mas em
  // branco (comum quando o arquivo é gerado com todas as chaves listadas)
  // não pode virar um nome de cookie vazio: a lib `cookie` rejeita nome
  // vazio com "argument name is invalid", quebrando o login inteiro.
  platformSessionCookieName: process.env.PLATFORM_SESSION_COOKIE_NAME || "platform_session",
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
  // E-mails transacionais (server/_core/emailService.ts) — em branco = envio
  // desligado (loga e segue, nunca derruba o fluxo que disparou o e-mail).
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailFromName: process.env.EMAIL_FROM_NAME || "MM System Creator",
  // Fora de produção, nunca manda e-mail de verdade pro destinatário real —
  // se preenchido, redireciona todo envio pra cá (pra poder ver o resultado
  // de verdade sem arriscar mandar pra um cliente real); se vazio, só loga.
  emailDevRecipient: process.env.EMAIL_DEV_RECIPIENT ?? "",
  // Origem do site comercial/Painel Master — usada só pra montar o link de
  // ação (`actionUrl`) dos e-mails disparados fora do contexto de uma
  // requisição (ex.: webhook, sem `returnOrigin` do cliente pra reaproveitar
  // como em server/routers/public.ts::signup).
  commercialSiteUrl: (process.env.COMMERCIAL_SITE_URL ?? "").replace(/\/+$/, ""),
  // Assistente de manutenção só-leitura (tela Manutenção do Painel Master,
  // ver server/_core/maintenanceAssistant.ts) — em branco = recurso desligado,
  // a tela mostra que precisa ser configurado em vez de travar.
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  // Notificações operacionais pro dono (novo cliente pago, restaurante
  // entregue) via Telegram — ver server/_core/telegramService.ts. Em branco =
  // desligado, só loga (nunca derruba o fluxo que disparou a notificação).
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  // Provisionamento automático de uma instância Docker isolada do sistema
  // (MM System Creator) por restaurante-cliente — ver
  // server/_core/pubxProvisioning.ts. Só funciona com os dois repositórios
  // na mesma máquina (nada de VPS aqui ainda). Em branco = desligado: o
  // restaurante é criado normalmente, só sem subir ambiente sozinho — a
  // equipe sobe na mão como já fazia antes.
  systemRepoPath: process.env.SYSTEM_REPO_PATH ?? "",
  systemDeploymentsDir: process.env.SYSTEM_DEPLOYMENTS_DIR ?? "",
};
