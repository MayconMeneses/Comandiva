import { bigint, int, json, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const signupPaymentStatusValues = ["pending", "paid", "restaurant_created", "expired"] as const;
export type SignupPaymentStatus = (typeof signupPaymentStatusValues)[number];

/**
 * Taxa de implementação (pagamento único, R$750 — Checkout Pro do Mercado
 * Pago, diferente da preapproval recorrente da mensalidade). O restaurante
 * NÃO existe ainda quando esta linha é criada — só nasce de verdade quando
 * o webhook confirma o pagamento aprovado (ver
 * server/db/signupPayments.ts::confirmSignupPaymentAndCreateRestaurant),
 * por isso o formulário inteiro fica salvo aqui em `payload` até esse
 * momento. Nunca criar o restaurante antes disso, nem por causa do retorno
 * da URL de sucesso.
 */
export const signupPayments = mysqlTable(
  "signup_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    payload: json("payload").notNull(),
    // Nula só durante a fração de segundo entre inserir esta linha (pra ter
    // um id pra usar como external_reference) e criar a preferência no
    // Mercado Pago — ver server/routers/public.ts::signup.
    mpPreferenceId: varchar("mpPreferenceId", { length: 160 }),
    mpPaymentId: varchar("mpPaymentId", { length: 160 }),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", signupPaymentStatusValues).notNull().default("pending"),
    restaurantId: int("restaurantId"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("signup_payments_preference_unique").on(table.mpPreferenceId)],
);

export type SignupPayment = typeof signupPayments.$inferSelect;

export type SignupPayload = {
  name: string;
  planKey: string;
  contactName?: string;
  contactEmail: string;
  contactPhone?: string;
};
