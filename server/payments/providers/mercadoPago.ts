import {
  createMercadoPagoCheckout,
  createMercadoPagoPixPayment,
  getMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "../../_core/mercadoPago";
import { mapMercadoPagoStatus } from "../statusMapping";
import type { PaymentProvider } from "../types";

/**
 * Adapter fino — só traduz o contrato comum `PaymentProvider` pras funções
 * já existentes em server/_core/mercadoPago.ts (cliente HTTP puro do MP).
 * Nenhuma lógica de chamada HTTP mora aqui, pra não duplicar o que já existe.
 */
export const mercadoPagoProvider: PaymentProvider = {
  name: "MERCADO_PAGO",

  getCapabilities() {
    return { pix: true, card: true, installments: false };
  },

  async createCardCheckout(input) {
    const redirectUrl = await createMercadoPagoCheckout({
      accessToken: input.accessToken,
      orderPublicCode: input.orderPublicCode,
      items: [{ title: input.description, quantity: 1, unit_price: input.amountCents / 100 }],
      backUrl: input.backUrl,
      idempotencyKey: input.idempotencyKey,
    });
    return { redirectUrl };
  },

  async createPixPayment(input) {
    const result = await createMercadoPagoPixPayment({
      accessToken: input.accessToken,
      orderPublicCode: input.orderPublicCode,
      amountCents: input.amountCents,
      description: input.description,
      payerEmail: input.payerEmail,
      payerCpf: input.payerCpf,
      notificationUrl: input.notificationUrl,
      expiresInMinutes: input.expiresInMinutes,
      idempotencyKey: input.idempotencyKey,
    });
    const status = mapMercadoPagoStatus(result.status) ?? "PENDING";
    return { providerPaymentId: result.providerPaymentId, status, pixCopyPaste: result.pixCopyPaste, expiresAt: result.expiresAt };
  },

  async getPaymentStatus(accessToken, providerPaymentId) {
    const payment = await getMercadoPagoPayment(accessToken, providerPaymentId);
    const status = mapMercadoPagoStatus(payment.status, payment.statusDetail) ?? "PENDING";
    return { providerPaymentId: String(payment.id), status, externalReference: payment.externalReference };
  },

  verifyWebhookSignature(input) {
    return verifyMercadoPagoWebhookSignature(input);
  },
};
