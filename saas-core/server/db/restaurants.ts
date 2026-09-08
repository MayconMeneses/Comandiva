import { and, eq } from "drizzle-orm";
import { generateApiKey, hashApiKey } from "../_core/apiKey";
import { getDb } from "./client";
import { plans, restaurants, subscriptionEvents, subscriptions, type PlanKey, type RestaurantStatus } from "../../drizzle/schema";
import { getPlanByKey } from "./plans";
import { getSubscriptionForRestaurant, listBillingPaymentsForSubscription } from "./subscriptions";
import { listPlatformAuditLog } from "./auditLog";

const TRIAL_DAYS = 14;

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

  const restaurantResult = await db.insert(restaurants).values({
    name: input.name,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    apiKeyHash,
    apiKeyPrefix,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const restaurantId = Number(restaurantResult[0].insertId);

  const currentPeriodEnd = now + TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const subscriptionResult = await db.insert(subscriptions).values({
    restaurantId,
    planId: plan.id,
    status: "trial",
    startedAt: now,
    currentPeriodStart: now,
    currentPeriodEnd,
    gateway: "MANUAL",
    createdAt: now,
    updatedAt: now,
  });
  const subscriptionId = Number(subscriptionResult[0].insertId);

  await db.insert(subscriptionEvents).values({
    subscriptionId,
    eventType: "created",
    afterJson: JSON.stringify({ planKey: plan.key, status: "trial" }),
    actor: input.actor ?? "operator:cli",
    createdAt: now,
  });

  return { restaurantId, apiKey, planKey: plan.key, status: "trial" as const };
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
  await db.update(restaurants).set({ status, updatedAt: Date.now() }).where(eq(restaurants.id, restaurantId));
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
export async function listRestaurantsForPanel(filters: { status?: RestaurantStatus; planKey?: PlanKey } = {}) {
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

  return rows.map(({ restaurant: { apiKeyHash: _apiKeyHash, ...restaurant }, subscription, plan }) => ({ ...restaurant, subscription, plan }));
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
