/**
 * Contrato comum de todo gateway de pagamento — o checkout e o resto do
 * sistema falam só com isto, nunca com Mercado Pago/InfinitePay/PayPal
 * diretamente (ver PaymentService). Cada provedor implementa só os métodos
 * que de fato suporta; `getCapabilities()` é quem informa isso ao checkout,
 * pra nunca oferecer ao cliente uma forma de pagamento que o gateway
 * configurado não sabe processar.
 */

/**
 * Vocabulário interno de status — o resto do sistema só conhece isto, nunca
 * o vocabulário específico de cada gateway ("approved", "authorized",
 * "completed" etc.). Cada provider tem seu próprio mapeamento (ver
 * statusMapping.ts) que traduz pra cá.
 */
export const INTERNAL_PAYMENT_STATUSES = ["PENDING", "PAID", "CANCELLED", "REFUNDED", "EXPIRED"] as const;
export type InternalPaymentStatus = (typeof INTERNAL_PAYMENT_STATUSES)[number];

export type PaymentCapabilities = {
  pix: boolean;
  card: boolean;
  installments: boolean;
};

export type CreateCardCheckoutInput = {
  accessToken: string;
  orderPublicCode: string;
  amountCents: number;
  description: string;
  backUrl: string;
  notificationUrl: string;
  /** Ver CreatePixPaymentInput.idempotencyKey — mesma lógica, pro Checkout Pro. */
  idempotencyKey: string;
};

export type CreateCardCheckoutResult = { redirectUrl: string };

export type CreatePixPaymentInput = {
  accessToken: string;
  orderPublicCode: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  payerCpf: string;
  notificationUrl: string;
  /** Minutos até expirar (o adapter decide o mínimo/máximo aceito pelo provedor). */
  expiresInMinutes: number;
  /**
   * Chave de idempotência pra esta TENTATIVA de cobrança — quem chama (o
   * router) decide, não o adapter/cliente HTTP: precisa mudar entre uma
   * geração de Pix e a próxima geração pro MESMO pedido (ex.: o Pix anterior
   * expirou e o cliente pediu um novo), senão o gateway devolve a cobrança
   * antiga (já vencida de verdade) em vez de criar uma nova — mas precisa
   * continuar IGUAL entre chamadas que são o mesmo clique/retry (evitando
   * duas cobranças reais pro mesmo pedido nesse caso).
   */
  idempotencyKey: string;
};

export type CreatePixPaymentResult = {
  providerPaymentId: string;
  status: InternalPaymentStatus;
  /** "Pix copia e cola" — é o único dado persistido (ver payments.metadata); o QR visual é gerado no cliente a partir dele. */
  pixCopyPaste: string;
  expiresAt: number;
};

export type ProviderPaymentStatus = {
  providerPaymentId: string;
  status: InternalPaymentStatus;
  externalReference: string | null;
};

export type VerifyWebhookSignatureInput = {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
};

export interface PaymentProvider {
  readonly name: string;
  getCapabilities(): PaymentCapabilities;
  /** Ausente quando getCapabilities().card === false. */
  createCardCheckout?(input: CreateCardCheckoutInput): Promise<CreateCardCheckoutResult>;
  /** Ausente quando getCapabilities().pix === false. */
  createPixPayment?(input: CreatePixPaymentInput): Promise<CreatePixPaymentResult>;
  getPaymentStatus(accessToken: string, providerPaymentId: string): Promise<ProviderPaymentStatus>;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean;
}
