import { bigint, index, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const subscriptionStatusValues = [
  "trial",
  "active",
  "payment_pending",
  "past_due",
  "cancel_at_period_end",
  "canceled",
  "suspended",
  "ended",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatusValues)[number];

// MANUAL = atribuído à mão pelo operador (ex.: cortesia, ajuste manual de
// suporte) — o fluxo real de cobrança hoje é MERCADO_PAGO (checkout,
// webhook e renovação automática já implementados, ver
// server/_core/mercadoPagoBilling.ts/mercadoPagoCheckout.ts/
// mercadoPagoWebhook.ts), não mais o único caso previsto quando este
// comentário foi escrito.
export const subscriptionGatewayValues = ["MANUAL", "MERCADO_PAGO"] as const;
export type SubscriptionGateway = (typeof subscriptionGatewayValues)[number];

/**
 * Uma linha por restaurante (não uma sequência de linhas históricas) — troca
 * de plano/status muta esta linha in-place, como toda assinatura real
 * funciona. O histórico completo de mudanças fica em subscription_events.
 */
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    restaurantId: int("restaurantId").notNull(),
    planId: int("planId").notNull(),
    status: mysqlEnum("status", subscriptionStatusValues).notNull().default("trial"),
    startedAt: bigint("startedAt", { mode: "number", unsigned: true }).notNull(),
    currentPeriodStart: bigint("currentPeriodStart", { mode: "number", unsigned: true }).notNull(),
    currentPeriodEnd: bigint("currentPeriodEnd", { mode: "number", unsigned: true }).notNull(),
    nextBillingAt: bigint("nextBillingAt", { mode: "number", unsigned: true }),
    canceledAt: bigint("canceledAt", { mode: "number", unsigned: true }),
    cancelReason: varchar("cancelReason", { length: 500 }),
    // Quando a assinatura entrou em "past_due" (Mercado Pago avisou que a
    // cobrança recorrente falhou e está em "recycling", tentando de novo) —
    // null quando não está em past_due. Usado pra contar os 5 dias de prazo
    // antes de bloquear o acesso (ver applyPastDueGracePeriod em
    // server/db/subscriptions.ts). Nunca reaproveita currentPeriodEnd/
    // updatedAt pra isso — precisa do momento exato em que o problema
    // começou, não de quando a linha foi tocada por outro motivo.
    pastDueSince: bigint("pastDueSince", { mode: "number", unsigned: true }),
    gateway: mysqlEnum("gateway", subscriptionGatewayValues).notNull().default("MANUAL"),
    gatewayCustomerId: varchar("gatewayCustomerId", { length: 160 }),
    gatewaySubscriptionId: varchar("gatewaySubscriptionId", { length: 160 }),
    // Downgrade self-service (ver server/db/subscriptions.ts::applyDueScheduledChanges):
    // plano pago/entitlements atuais continuam valendo até currentPeriodEnd —
    // só nesse momento planId vira scheduledPlanId. Nulo = nenhum downgrade
    // agendado. Cancelamento agendado usa só `status = cancel_at_period_end`
    // (não precisa de coluna própria — currentPeriodEnd já é a data efetiva).
    scheduledPlanId: int("scheduledPlanId"),
    // Promoção de lançamento (20% de desconto nos 2 primeiros meses da
    // mensalidade) — quantos ciclos de cobrança ainda faltam com desconto.
    // Null = sem promoção ativa nesta assinatura. Decrementado em
    // applyDueScheduledChanges a cada rolagem de período; ao chegar a 0, o
    // valor da preapproval volta pro preço cheio do plano.
    promoDiscountCyclesRemaining: int("promoDiscountCyclesRemaining"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("subscriptions_restaurant_unique").on(table.restaurantId),
    index("subscriptions_status_idx").on(table.status),
  ],
);

/**
 * Histórico de cobranças da ASSINATURA SAAS (o restaurante pagando o SaaS).
 * Nome propositalmente distinto da tabela `payments` do app principal (ali é
 * o cliente final pagando a comida) — assuntos de cobrança completamente
 * diferentes, nunca confundir as duas.
 */
export const billingPayments = mysqlTable(
  "billing_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    subscriptionId: int("subscriptionId").notNull(),
    gateway: varchar("gateway", { length: 40 }).notNull(),
    gatewayPaymentId: varchar("gatewayPaymentId", { length: 160 }),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).notNull().default("pending"),
    paidAt: bigint("paidAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("billing_payments_subscription_idx").on(table.subscriptionId, table.createdAt)],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type BillingPayment = typeof billingPayments.$inferSelect;
