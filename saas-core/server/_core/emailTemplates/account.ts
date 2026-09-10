import { escapeHtml, paragraph, renderEmailLayout } from "./base";
import type { EmailTemplateDefinition } from "./types";

export type WelcomeVars = { customerName: string; restaurantName: string; planName: string; actionUrl: string };
export const welcome: EmailTemplateDefinition<WelcomeVars> = {
  subject: vars => `Bem-vindo(a), ${vars.customerName}!`,
  render: vars => renderEmailLayout({
    title: "Bem-vindo",
    bodyHtml: paragraph(`Olá, ${vars.customerName}! Sua conta para ${escapeHtml(vars.restaurantName)} (plano ${escapeHtml(vars.planName)}) foi criada.`)
      + paragraph("Agora é só configurar seu cardápio e horários — nosso time está à disposição para ajudar na configuração inicial."),
    ctaLabel: "Configurar meu restaurante",
    ctaUrl: vars.actionUrl,
  }),
};

/** Nunca envia a senha em si — só um link de uso único com expiração. Ver regra #39 do prompt do dono. */
export type PasswordResetVars = { customerName: string; actionUrl: string; expiresInMinutes: number };
export const passwordReset: EmailTemplateDefinition<PasswordResetVars> = {
  subject: () => "Redefinir sua senha",
  render: vars => renderEmailLayout({
    title: "Redefinição de senha",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Recebemos uma solicitação para redefinir sua senha.`)
      + paragraph(`Este link expira em ${vars.expiresInMinutes} minutos e só pode ser usado uma vez. Se você não pediu essa redefinição, pode ignorar este e-mail com segurança — sua senha continua a mesma.`),
    ctaLabel: "Redefinir senha",
    ctaUrl: vars.actionUrl,
  }),
};

export type RestaurantReadyVars = { customerName: string; restaurantName: string; actionUrl: string };
export const restaurantReady: EmailTemplateDefinition<RestaurantReadyVars> = {
  subject: () => "Seu restaurante está pronto!",
  render: vars => renderEmailLayout({
    title: "Restaurante pronto",
    bodyHtml: paragraph(`Boas notícias, ${vars.customerName}! ${escapeHtml(vars.restaurantName)} está configurado e pronto para receber pedidos.`)
      + paragraph("Confira o cardápio publicado e compartilhe o link com seus clientes."),
    ctaLabel: "Ver meu restaurante",
    ctaUrl: vars.actionUrl,
  }),
};

export type AccessReleasedVars = { customerName: string; restaurantName: string; actionUrl: string };
export const accessReleased: EmailTemplateDefinition<AccessReleasedVars> = {
  subject: () => "Acesso liberado",
  render: vars => renderEmailLayout({
    title: "Acesso liberado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Seu acesso ao painel de ${escapeHtml(vars.restaurantName)} foi liberado.`)
      + paragraph("Você já pode entrar com seu login e senha."),
    ctaLabel: "Acessar o painel",
    ctaUrl: vars.actionUrl,
  }),
};
