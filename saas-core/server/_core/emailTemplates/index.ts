import { accessReleased, passwordReset, restaurantReady, welcome } from "./account";
import { paymentApproved, paymentFailed, paymentOverdue, paymentPending, paymentRecovered } from "./payment";
import { subscriptionAccessSuspended, subscriptionCancelEffective, subscriptionCancelRequested, subscriptionDowngraded, subscriptionRenewalFailed, subscriptionRenewed, subscriptionUpgraded } from "./subscription";

/**
 * Registro central — todo template passa por aqui, nunca é chamado direto
 * pelos módulos de negócio (payment/subscription/account.ts ficam
 * "privados" a este diretório). `emailService.send()` só aceita um
 * `EmailTemplateId` + as variáveis exatas daquele template (ver types.ts).
 */
export const EMAIL_TEMPLATES = {
  welcome,
  passwordReset,
  restaurantReady,
  accessReleased,
  paymentApproved,
  paymentPending,
  paymentFailed,
  paymentOverdue,
  paymentRecovered,
  subscriptionRenewed,
  subscriptionRenewalFailed,
  subscriptionUpgraded,
  subscriptionDowngraded,
  subscriptionCancelRequested,
  subscriptionCancelEffective,
  subscriptionAccessSuspended,
} as const;

export type EmailTemplateId = keyof typeof EMAIL_TEMPLATES;
