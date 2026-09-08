import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { billingPayments, plans, restaurants, subscriptionEvents, subscriptions } from "../../drizzle/schema";

function startOfCurrentMonthMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

const SIGNUPS_TREND_WEEKS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Novos cadastros (subscriptionEvents.eventType = "created") por semana, nas
 * últimas SIGNUPS_TREND_WEEKS semanas (contando a semana atual) — da semana
 * mais antiga pra mais recente. Volume baixo o suficiente pra trazer as
 * linhas cruas e agrupar em memória, sem precisar de GROUP BY por semana.
 */
async function getSignupsTrend(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const windowStart = Date.now() - SIGNUPS_TREND_WEEKS * WEEK_MS;

  const buckets = Array.from({ length: SIGNUPS_TREND_WEEKS }, (_, i) => ({
    weekStart: windowStart + i * WEEK_MS,
    count: 0,
  }));

  const rows = await db
    .select({ createdAt: subscriptionEvents.createdAt })
    .from(subscriptionEvents)
    .where(and(eq(subscriptionEvents.eventType, "created"), gte(subscriptionEvents.createdAt, windowStart)));

  for (const row of rows) {
    const index = Math.min(SIGNUPS_TREND_WEEKS - 1, Math.max(0, Math.floor((row.createdAt - windowStart) / WEEK_MS)));
    buckets[index].count += 1;
  }

  return buckets;
}

/**
 * Resumo do dashboard global — só com dado que já existe de verdade hoje no
 * saas-core. Nada de inventar métricas de infra/Telegram/erros que ainda não
 * são coletadas em lugar nenhum.
 */
export async function getDashboardSummary() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const restaurantsByStatus = await db.select({ status: restaurants.status, total: count() }).from(restaurants).groupBy(restaurants.status);

  const activeSubscriptionsByPlan = await db
    .select({ planKey: plans.key, planName: plans.name, priceCents: plans.priceCents, total: count() })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.status, "active"))
    .groupBy(plans.key, plans.name, plans.priceCents);

  // MRR = preço do plano × nº de assinaturas ativas nele — válido mesmo sem
  // cobrança real integrada ainda, porque é a própria definição de MRR.
  const mrrCents = activeSubscriptionsByPlan.reduce((total, row) => total + row.priceCents * row.total, 0);

  const monthStart = startOfCurrentMonthMs();
  const [newCustomersRow] = await db
    .select({ total: count() })
    .from(subscriptionEvents)
    .where(and(eq(subscriptionEvents.eventType, "created"), gte(subscriptionEvents.createdAt, monthStart)));

  const planChangeEvents = await db
    .select()
    .from(subscriptionEvents)
    .where(and(eq(subscriptionEvents.eventType, "plan_changed"), gte(subscriptionEvents.createdAt, monthStart)));
  const allPlans = await db.select().from(plans);
  const positionByKey = new Map(allPlans.map(plan => [plan.key, plan.position]));
  let upgrades = 0;
  let downgrades = 0;
  let lateral = 0;
  for (const event of planChangeEvents) {
    const before = event.beforeJson ? JSON.parse(event.beforeJson) : null;
    const after = event.afterJson ? JSON.parse(event.afterJson) : null;
    const beforePos = positionByKey.get(before?.planKey);
    const afterPos = positionByKey.get(after?.planKey);
    if (beforePos === undefined || afterPos === undefined) continue;
    if (afterPos > beforePos) upgrades += 1;
    else if (afterPos < beforePos) downgrades += 1;
    else lateral += 1;
  }

  const [paymentsRow] = await db.select({ total: count() }).from(billingPayments);

  const signupsTrend = await getSignupsTrend(db);

  return {
    restaurantsByStatus,
    activeSubscriptionsByPlan,
    mrrCents,
    newCustomersThisMonth: newCustomersRow?.total ?? 0,
    planChangesThisMonth: { upgrades, downgrades, lateral },
    hasAnyPayments: (paymentsRow?.total ?? 0) > 0,
    signupsTrend,
  };
}
