import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { signupPayments, subscriptionEvents, type SignupPayload } from "../../drizzle/schema";
import { createRestaurantWithSubscription, hasRestaurantForContact } from "./restaurants";
import { getSubscriptionForRestaurant } from "./subscriptions";
import { getPlanByKey } from "./plans";
import { recordPlatformAuditLog } from "./auditLog";
import { sendEmailAsync } from "../_core/emailService";
import { buildNewPaidSignupMessage, sendTelegramMessageAsync } from "../_core/telegramService";
import { provisionSystemInstance } from "../_core/systemProvisioning";
import { ENV } from "../_core/env";

/** Cria a linha ANTES de existir preferência no Mercado Pago — o id gerado aqui vira o external_reference da preferência. */
export async function createSignupPayment(input: { payload: SignupPayload; amountCents: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const result = await db.insert(signupPayments).values({
    payload: input.payload,
    amountCents: input.amountCents,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return { id: Number(result[0].insertId) };
}

export async function attachMpPreference(signupPaymentId: number, mpPreferenceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(signupPayments).set({ mpPreferenceId, updatedAt: Date.now() }).where(eq(signupPayments.id, signupPaymentId));
}

export async function getSignupPaymentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(signupPayments).where(eq(signupPayments.id, id)).limit(1);
  return row;
}

export async function getSignupPaymentByPreferenceId(mpPreferenceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(signupPayments).where(eq(signupPayments.mpPreferenceId, mpPreferenceId)).limit(1);
  return row;
}

/**
 * Único ponto que transforma um pagamento aprovado num restaurante de
 * verdade. Idempotente: se esta linha já estiver `restaurant_created`
 * (retry do webhook, por exemplo), não faz nada de novo — nunca cria dois
 * restaurantes pro mesmo pagamento.
 */
export async function confirmSignupPaymentAndCreateRestaurant(signupPaymentId: number, mpPaymentId: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getSignupPaymentById(signupPaymentId);
  if (!row) return { found: false as const };
  if (row.status === "restaurant_created") return { found: true as const, alreadyProcessed: true as const, restaurantId: row.restaurantId! };

  const payload = row.payload as SignupPayload;
  // E-mail/telefone que já teve restaurante antes (mesmo cancelado/encerrado)
  // não ganha um novo trial de 7 dias — sem isso, cancelar e cadastrar de
  // novo dava teste grátis indefinidamente (achado da auditoria de
  // segurança). Só se aplica ao cadastro público — criação manual via
  // Painel Master/CLI continua concedendo trial normalmente, um operador
  // humano já decide conscientemente ali.
  const isRepeatContact = await hasRestaurantForContact(payload.contactEmail, payload.contactPhone);
  const result = await createRestaurantWithSubscription({
    name: payload.name,
    planKey: payload.planKey,
    contactName: payload.contactName,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    actor: "public:signup",
    grantTrial: !isRepeatContact,
  });

  const now = Date.now();
  await db
    .update(signupPayments)
    .set({ status: "restaurant_created", mpPaymentId, restaurantId: result.restaurantId, updatedAt: now })
    .where(eq(signupPayments.id, signupPaymentId));

  // Registrado no timeline do restaurante (subscription_events) pra ficar
  // visível no Painel Master junto com o resto do histórico de cobrança.
  const current = await getSubscriptionForRestaurant(result.restaurantId);
  if (current) {
    await db.insert(subscriptionEvents).values({
      subscriptionId: current.subscription.id,
      eventType: "implementation_fee_paid",
      afterJson: JSON.stringify({ mpPaymentId, amountCents: row.amountCents }),
      actor: "mercadopago:webhook",
      createdAt: now,
    });
  }

  await recordPlatformAuditLog({
    actorLabel: payload.contactEmail,
    action: "restaurant.public_signup",
    entityType: "restaurant",
    entityId: result.restaurantId,
    after: { planKey: result.planKey, status: result.status, implementationFeeCents: row.amountCents },
  });

  // Fogo-e-esquece de propósito — uma falha de e-mail aqui nunca pode
  // desfazer a criação do restaurante nem o pagamento já confirmado (ver
  // prompt do dono, regra #30). O contato ainda não tem login em lugar
  // nenhum neste momento (o deployment do restaurante é provisionado à
  // parte, depois — ver markRestaurantDelivered), por isso o link aponta
  // pro site comercial, não pro painel do restaurante em si. Sem
  // COMMERCIAL_SITE_URL configurada, o link fica relativo (o e-mail ainda
  // sai, só sem link clicável de verdade) — mesmo raciocínio de "nunca
  // travar por falta de config opcional" do resto do serviço.
  const plan = await getPlanByKey(payload.planKey);
  sendEmailAsync(payload.contactEmail, "paymentApproved", {
    customerName: payload.contactName || payload.name,
    restaurantName: payload.name,
    planName: plan?.name ?? payload.planKey,
    amountCents: row.amountCents,
    paymentDate: now,
    actionUrl: `${ENV.commercialSiteUrl}/comercial/cadastro/confirmando?ref=${signupPaymentId}`,
  });

  // Mesmo raciocínio fogo-e-esquece do e-mail acima — só que pro dono da
  // plataforma, não pro cliente, pra ele saber na hora que entrou um cliente
  // pago novo (a equipe ainda organiza cardápio/config na mão nesta etapa).
  sendTelegramMessageAsync(
    buildNewPaidSignupMessage({
      restaurantId: result.restaurantId,
      restaurantName: payload.name,
      planName: plan?.name ?? payload.planKey,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      amountCents: row.amountCents,
      apiKey: result.apiKey,
      repeatContact: isRepeatContact,
    }),
  );

  // Provisionamento fica manual de propósito (ver systemProvisioning.ts) —
  // isto só manda pro Telegram o comando pronto pra equipe rodar na VPS.
  provisionSystemInstance({ restaurantId: result.restaurantId, restaurantName: payload.name, apiKey: result.apiKey });

  return { found: true as const, alreadyProcessed: false as const, restaurantId: result.restaurantId };
}
