import { formatCurrency, formatDate } from "../../../shared/format";
import { escapeHtml, highlightBox, paragraph, renderEmailLayout } from "./base";
import type { EmailTemplateDefinition } from "./types";

export type SubscriptionRenewedVars = { customerName: string; restaurantName: string; planName: string; amountCents: number; renewalDate: number; nextBillingDate: number; actionUrl: string };
export const subscriptionRenewed: EmailTemplateDefinition<SubscriptionRenewedVars> = {
  subject: () => "Renovação confirmada — sua assinatura foi renovada",
  render: vars => renderEmailLayout({
    title: "Renovação confirmada",
    bodyHtml: paragraph(`Olá, ${vars.customerName}! A assinatura de ${escapeHtml(vars.restaurantName)} foi renovada com sucesso.`)
      + highlightBox([["Plano", vars.planName], ["Valor cobrado", formatCurrency(vars.amountCents)], ["Renovado em", formatDate(vars.renewalDate)], ["Próxima cobrança", formatDate(vars.nextBillingDate)]])
      + paragraph("Nenhuma ação necessária da sua parte."),
    ctaLabel: "Ver detalhes da assinatura",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionRenewalFailedVars = { customerName: string; restaurantName: string; planName: string; amountCents: number; actionUrl: string };
export const subscriptionRenewalFailed: EmailTemplateDefinition<SubscriptionRenewalFailedVars> = {
  subject: () => "Não foi possível renovar sua assinatura",
  render: vars => renderEmailLayout({
    title: "Falha na renovação",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Não conseguimos confirmar a cobrança de renovação da assinatura de ${escapeHtml(vars.restaurantName)}.`)
      + highlightBox([["Plano", vars.planName], ["Valor", formatCurrency(vars.amountCents)]])
      + paragraph("Verifique os dados do seu meio de pagamento — seu acesso continua ativo durante o período de tolerância."),
    ctaLabel: "Atualizar pagamento",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionUpgradedVars = { customerName: string; restaurantName: string; previousPlanName: string; newPlanName: string; actionUrl: string };
export const subscriptionUpgraded: EmailTemplateDefinition<SubscriptionUpgradedVars> = {
  subject: vars => `Plano atualizado para ${vars.newPlanName}`,
  render: vars => renderEmailLayout({
    title: "Upgrade confirmado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}! O plano de ${escapeHtml(vars.restaurantName)} foi atualizado.`)
      + highlightBox([["Plano anterior", vars.previousPlanName], ["Novo plano", vars.newPlanName]])
      + paragraph("Os novos recursos já estão liberados no seu painel."),
    ctaLabel: "Ver novos recursos",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionDowngradedVars = { customerName: string; restaurantName: string; previousPlanName: string; newPlanName: string; effectiveDate: number; actionUrl: string };
export const subscriptionDowngraded: EmailTemplateDefinition<SubscriptionDowngradedVars> = {
  subject: vars => `Alteração de plano confirmada — ${vars.newPlanName}`,
  render: vars => renderEmailLayout({
    title: "Downgrade confirmado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Confirmamos a solicitação de alteração de plano de ${escapeHtml(vars.restaurantName)}.`)
      + highlightBox([["Plano atual", vars.previousPlanName], ["Novo plano", vars.newPlanName], ["Válido a partir de", formatDate(vars.effectiveDate)]])
      + paragraph(`Você continua com acesso completo ao plano ${escapeHtml(vars.previousPlanName)} até essa data — nada muda antes disso.`),
    ctaLabel: "Ver detalhes",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionCancelRequestedVars = { customerName: string; restaurantName: string; accessUntil: number; actionUrl: string };
export const subscriptionCancelRequested: EmailTemplateDefinition<SubscriptionCancelRequestedVars> = {
  subject: () => "Cancelamento solicitado",
  render: vars => renderEmailLayout({
    title: "Cancelamento solicitado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Recebemos sua solicitação de cancelamento da assinatura de ${escapeHtml(vars.restaurantName)}.`)
      + highlightBox([["Acesso garantido até", formatDate(vars.accessUntil)]])
      + paragraph("Você pode continuar usando o sistema normalmente até essa data. Se mudar de ideia, é só reativar pelo painel antes do prazo."),
    ctaLabel: "Gerenciar assinatura",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionAccessSuspendedVars = { customerName: string; restaurantName: string; graceDaysUsed: number; actionUrl: string };
export const subscriptionAccessSuspended: EmailTemplateDefinition<SubscriptionAccessSuspendedVars> = {
  subject: () => "Acesso suspenso por falta de pagamento",
  render: vars => renderEmailLayout({
    title: "Acesso suspenso",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Passaram-se ${vars.graceDaysUsed} dias sem conseguirmos confirmar a cobrança da mensalidade de ${escapeHtml(vars.restaurantName)}, e o acesso foi suspenso.`)
      + paragraph("Assim que o pagamento for regularizado, o acesso volta automaticamente — sem precisar entrar em contato com o suporte."),
    ctaLabel: "Regularizar pagamento",
    ctaUrl: vars.actionUrl,
  }),
};

export type SubscriptionCancelEffectiveVars = { customerName: string; restaurantName: string; actionUrl: string };
export const subscriptionCancelEffective: EmailTemplateDefinition<SubscriptionCancelEffectiveVars> = {
  subject: () => "Assinatura encerrada",
  render: vars => renderEmailLayout({
    title: "Assinatura encerrada",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. A assinatura de ${escapeHtml(vars.restaurantName)} foi encerrada, conforme solicitado.`)
      + paragraph("Sentiremos sua falta. Se quiser voltar no futuro, é só contratar novamente pelo site."),
    ctaLabel: "Falar com o suporte",
    ctaUrl: vars.actionUrl,
  }),
};
