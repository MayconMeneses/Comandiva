import { formatCurrency, formatDate } from "../../../shared/format";
import { escapeHtml, highlightBox, paragraph, renderEmailLayout } from "./base";
import type { EmailTemplateDefinition } from "./types";

export type PaymentApprovedVars = { customerName: string; restaurantName: string; planName: string; amountCents: number; paymentDate: number; actionUrl: string };
export const paymentApproved: EmailTemplateDefinition<PaymentApprovedVars> = {
  subject: () => "Pagamento aprovado — sua assinatura está ativa",
  render: vars => renderEmailLayout({
    title: "Pagamento aprovado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}! Recebemos o pagamento e sua assinatura já está ativa.`)
      + highlightBox([["Restaurante", vars.restaurantName], ["Plano", vars.planName], ["Valor", formatCurrency(vars.amountCents)], ["Data", formatDate(vars.paymentDate)]])
      + paragraph("Você já pode acessar o painel e configurar seu restaurante."),
    ctaLabel: "Acessar o painel",
    ctaUrl: vars.actionUrl,
  }),
};

export type PaymentPendingVars = { customerName: string; restaurantName: string; amountCents: number; actionUrl: string };
export const paymentPending: EmailTemplateDefinition<PaymentPendingVars> = {
  subject: () => "Pagamento pendente — aguardando confirmação",
  render: vars => renderEmailLayout({
    title: "Pagamento pendente",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Recebemos sua solicitação de pagamento para ${vars.restaurantName}, mas ainda está aguardando confirmação do meio de pagamento escolhido.`)
      + highlightBox([["Valor", formatCurrency(vars.amountCents)]])
      + paragraph("Assim que for confirmado, você recebe um novo e-mail e o acesso é liberado automaticamente. Isso costuma levar de alguns minutos a 2 dias úteis, dependendo do meio de pagamento."),
    ctaLabel: "Acompanhar status",
    ctaUrl: vars.actionUrl,
  }),
};

export type PaymentFailedVars = { customerName: string; restaurantName: string; actionUrl: string };
export const paymentFailed: EmailTemplateDefinition<PaymentFailedVars> = {
  subject: () => "Não foi possível confirmar seu pagamento",
  render: vars => renderEmailLayout({
    title: "Pagamento não aprovado",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. Não conseguimos confirmar o pagamento para ${vars.restaurantName}.`)
      + paragraph("Isso pode acontecer por diversos motivos do lado do meio de pagamento (saldo, limite, dados do cartão). Você pode tentar novamente com o mesmo ou outro meio de pagamento."),
    ctaLabel: "Tentar novamente",
    ctaUrl: vars.actionUrl,
  }),
};

export type PaymentOverdueVars = { customerName: string; restaurantName: string; planName: string; amountCents: number; dueDate: number; graceDays: number; actionUrl: string };
export const paymentOverdue: EmailTemplateDefinition<PaymentOverdueVars> = {
  subject: () => "Pagamento em atraso — ação necessária",
  render: vars => renderEmailLayout({
    title: "Pagamento em atraso",
    bodyHtml: paragraph(`Olá, ${vars.customerName}. A cobrança da assinatura de ${vars.restaurantName} não foi confirmada até o momento.`)
      + highlightBox([["Plano", vars.planName], ["Valor", formatCurrency(vars.amountCents)], ["Vencimento", formatDate(vars.dueDate)]])
      + paragraph(`Seu acesso continua funcionando normalmente por mais ${vars.graceDays} dia(s) — regularize o pagamento nesse período para evitar qualquer interrupção.`),
    ctaLabel: "Regularizar pagamento",
    ctaUrl: vars.actionUrl,
  }),
};

export type PaymentRecoveredVars = { customerName: string; restaurantName: string; amountCents: number; actionUrl: string };
export const paymentRecovered: EmailTemplateDefinition<PaymentRecoveredVars> = {
  subject: () => "Pagamento confirmado — assinatura regularizada",
  render: vars => renderEmailLayout({
    title: "Assinatura regularizada",
    bodyHtml: paragraph(`Olá, ${vars.customerName}! Recebemos o pagamento de ${formatCurrency(vars.amountCents)} e a assinatura de ${escapeHtml(vars.restaurantName)} está regularizada.`)
      + paragraph("Seu acesso continua ativo normalmente — obrigado por regularizar."),
    ctaLabel: "Acessar o painel",
    ctaUrl: vars.actionUrl,
  }),
};
