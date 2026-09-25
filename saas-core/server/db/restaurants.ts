import { and, eq } from "drizzle-orm";
import { generateApiKey, hashApiKey } from "../_core/apiKey";
import { getDb } from "./client";
import { plans, restaurants, subscriptionEvents, subscriptions, type PlanKey, type RestaurantStatus } from "../../drizzle/schema";
import { getPlanByKey } from "./plans";
import { getSubscriptionForRestaurant, listBillingPaymentsForSubscription } from "./subscriptions";
import { listPlatformAuditLog } from "./auditLog";
import { sendEmailAsync } from "../_core/emailService";
import { buildRestaurantDeliveredMessage, sendTelegramMessageAsync } from "../_core/telegramService";
import { commercialHomeUrl } from "../_core/env";

// O teste grátis só começa a contar quando a equipe marca o restaurante como
// entregue (menu/config organizados) — nunca no momento do cadastro. Ver
// markRestaurantDelivered abaixo.
const TRIAL_DAYS = 30;
const DELIVERY_SLA_BUSINESS_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// Promoção de lançamento: 20% de desconto na mensalidade nos 2 primeiros
// ciclos (ver server/db/subscriptions.ts::startOrChangePlan/applyDueScheduledChanges).
// Desligar aqui (false) quando a promoção acabar — sem UI própria pra isso ainda.
export const LAUNCH_PROMO_ACTIVE = true;

/** Soma N dias úteis (pula sábado/domingo) a partir de um timestamp. Exportada só pra teste. */
export function addBusinessDays(fromMs: number, days: number): number {
  const date = new Date(fromMs);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const weekday = date.getDay(); // 0 = domingo, 6 = sábado
    if (weekday !== 0 && weekday !== 6) added += 1;
  }
  return date.getTime();
}

export type CreateRestaurantInput = {
  name: string;
  planKey: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  actor?: string;
};

/**
 * Cria um restaurante-cliente novo + sua assinatura inicial (status "trial"),
 * numa única operação. Devolve a API key em texto puro — a ÚNICA vez que ela
 * existe fora do hash guardado no banco; quem chama precisa copiar/salvar
 * imediatamente (mesmo padrão de senha provisória exibida uma vez só).
 */
export async function createRestaurantWithSubscription(input: CreateRestaurantInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const plan = await getPlanByKey(input.planKey);
  if (!plan) throw new Error(`Plano "${input.planKey}" não encontrado.`);

  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();
  const now = Date.now();

  const deliveryDueAt = addBusinessDays(now, DELIVERY_SLA_BUSINESS_DAYS);

  const restaurantResult = await db.insert(restaurants).values({
    name: input.name,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    apiKeyHash,
    apiKeyPrefix,
    status: "active",
    deliveryDueAt,
    deliveredAt: null,
    promoEligible: LAUNCH_PROMO_ACTIVE,
    createdAt: now,
    updatedAt: now,
  });
  const restaurantId = Number(restaurantResult[0].insertId);

  // Período "zerado" de propósito (start = end = agora): o teste grátis de
  // verdade só passa a contar em markRestaurantDelivered, quando a
  // configuração estiver pronta — nunca no cadastro em si.
  const subscriptionResult = await db.insert(subscriptions).values({
    restaurantId,
    planId: plan.id,
    status: "trial",
    startedAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: now,
    gateway: "MANUAL",
    createdAt: now,
    updatedAt: now,
  });
  const subscriptionId = Number(subscriptionResult[0].insertId);

  await db.insert(subscriptionEvents).values({
    subscriptionId,
    eventType: "created",
    afterJson: JSON.stringify({ planKey: plan.key, status: "trial", deliveryDueAt }),
    actor: input.actor ?? "operator:cli",
    createdAt: now,
  });

  return { restaurantId, apiKey, planKey: plan.key, status: "trial" as const, deliveryDueAt };
}

/**
 * Marca a configuração do restaurante como concluída e é só NESSE momento
 * que o teste grátis de 30 dias passa a contar de verdade — regra de
 * negócio central: o cliente não pode ter o tempo de trial consumido
 * enquanto a equipe ainda está organizando cardápio/config dele.
 */
export async function markRestaurantDelivered(restaurantId: number, actor: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  if (!restaurant) throw new Error("Restaurante não encontrado.");
  if (restaurant.deliveredAt) throw new Error("Este restaurante já foi marcado como entregue.");

  const current = await getSubscriptionForRestaurant(restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");

  const now = Date.now();
  const currentPeriodEnd = now + TRIAL_DAYS * DAY_MS;

  await db.update(restaurants).set({ deliveredAt: now, updatedAt: now }).where(eq(restaurants.id, restaurantId));

  // Só reinicia o período se ainda estiver em trial — se por algum motivo já
  // foi pra um plano pago antes da entrega (não deveria acontecer no fluxo
  // normal), o ciclo de cobrança real do Mercado Pago não é mexido aqui.
  if (current.subscription.status === "trial") {
    await db
      .update(subscriptions)
      .set({ currentPeriodStart: now, currentPeriodEnd, updatedAt: now })
      .where(eq(subscriptions.id, current.subscription.id));
  }

  await recordSubscriptionDeliveredEvent(current.subscription.id, currentPeriodEnd, actor);

  if (restaurant.contactEmail) {
    sendEmailAsync(restaurant.contactEmail, "restaurantReady", {
      customerName: restaurant.contactName || restaurant.name,
      restaurantName: restaurant.name,
      actionUrl: restaurant.deploymentUrl || commercialHomeUrl,
    });
  }

  sendTelegramMessageAsync(buildRestaurantDeliveredMessage({ restaurantId, restaurantName: restaurant.name, trialEndsAt: currentPeriodEnd }));

  return { success: true as const, trialEndsAt: currentPeriodEnd };
}

async function recordSubscriptionDeliveredEvent(subscriptionId: number, trialEndsAt: number, actor: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(subscriptionEvents).values({
    subscriptionId,
    eventType: "delivered_trial_started",
    afterJson: JSON.stringify({ trialEndsAt }),
    actor,
    createdAt: Date.now(),
  });
}

export async function getRestaurantByApiKeyHash(hash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.apiKeyHash, hash)).limit(1);
  return restaurant;
}

export async function listRestaurants() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(restaurants);
  // apiKeyHash nunca sai do banco pra fora — mesmo padrão de payment_gateways
  // no app principal (só um booleano/prefixo indicando que existe).
  return rows.map(({ apiKeyHash: _apiKeyHash, ...rest }) => rest);
}

export async function rotateApiKey(restaurantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey();
  await db.update(restaurants).set({ apiKeyHash, apiKeyPrefix, updatedAt: Date.now() }).where(eq(restaurants.id, restaurantId));
  return { apiKey };
}

export async function setRestaurantStatus(restaurantId: number, status: RestaurantStatus) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  // cancelledAt marca a última vez que virou "cancelled" — usado só pra
  // ocultar da lista principal do Painel Master 10 dias depois (ver
  // listRestaurantsForPanel). Reativar (voltar pra active/suspended) limpa
  // a marca, senão uma reativação e novo cancelamento futuro reaproveitaria
  // a data antiga e ocultaria cedo demais.
  await db.update(restaurants).set({ status, cancelledAt: status === "cancelled" ? now : null, updatedAt: now }).where(eq(restaurants.id, restaurantId));
  return { success: true };
}

export async function getRestaurantById(restaurantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  return restaurant;
}

export async function setRestaurantDeploymentUrl(restaurantId: number, deploymentUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(restaurants).set({ deploymentUrl, updatedAt: Date.now() }).where(eq(restaurants.id, restaurantId));
  return { success: true };
}

export type UpdateRestaurantContactInput = {
  name?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export async function updateRestaurantContact(restaurantId: number, input: UpdateRestaurantContactInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(restaurants).set({ ...input, updatedAt: Date.now() }).where(eq(restaurants.id, restaurantId));
  return { success: true };
}

/** Lista pro Painel Master — cada restaurante já com plano/status de assinatura, filtrável. */
// Assinaturas com pagamento em atraso — junto com restaurants.status ===
// "suspended", forma o grupo do meio na ordenação (ativos, pagamentos
// atrasados, cancelados) pedida pelo dono do produto.
const PAYMENT_TROUBLE_SUBSCRIPTION_STATUSES = new Set(["payment_pending", "past_due", "cancel_at_period_end"]);
const HIDE_CANCELLED_AFTER_DAYS = 10;

/** Exportada só pra teste. */
export function restaurantSortPriority(restaurant: { status: RestaurantStatus }, subscription: { status: string }): number {
  if (restaurant.status === "cancelled") return 2;
  if (restaurant.status === "suspended" || PAYMENT_TROUBLE_SUBSCRIPTION_STATUSES.has(subscription.status)) return 1;
  return 0;
}

export async function listRestaurantsForPanel(filters: { status?: RestaurantStatus; planKey?: PlanKey; includeHidden?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    filters.status ? eq(restaurants.status, filters.status) : undefined,
    filters.planKey ? eq(plans.key, filters.planKey) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));

  const rows = await db
    .select({ restaurant: restaurants, subscription: subscriptions, plan: plans })
    .from(restaurants)
    .innerJoin(subscriptions, eq(subscriptions.restaurantId, restaurants.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(conditions.length ? and(...conditions) : undefined);

  const now = Date.now();
  const visible = filters.includeHidden
    ? rows
    : rows.filter(({ restaurant }) => !(restaurant.status === "cancelled" && restaurant.cancelledAt != null && now - restaurant.cancelledAt > HIDE_CANCELLED_AFTER_DAYS * DAY_MS));

  return visible
    .map(({ restaurant: { apiKeyHash: _apiKeyHash, ...restaurant }, subscription, plan }) => ({ ...restaurant, subscription, plan }))
    .sort((a, b) => restaurantSortPriority(a, a.subscription) - restaurantSortPriority(b, b.subscription));
}

/** Detalhe completo pro Painel Master: Dados + Plano + Pagamentos + últimas ações de auditoria envolvendo este restaurante. */
export async function getRestaurantDetailForPanel(restaurantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  if (!restaurant) return undefined;
  const { apiKeyHash: _apiKeyHash, ...restaurantWithoutKey } = restaurant;

  const subscription = await getSubscriptionForRestaurant(restaurantId);
  const [payments, auditEntries] = await Promise.all([
    subscription ? listBillingPaymentsForSubscription(subscription.subscription.id) : Promise.resolve([]),
    listPlatformAuditLog({ entityType: "restaurant", entityId: restaurantId, limit: 20 }),
  ]);

  return { restaurant: restaurantWithoutKey, subscription, payments, auditEntries };
}

export { hashApiKey };
