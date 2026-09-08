import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { features, planFeatures, planLimits, plans } from "../../drizzle/schema";

export async function getPlanByKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [plan] = await db.select().from(plans).where(eq(plans.key, key as (typeof plans.key.enumValues)[number])).limit(1);
  return plan;
}

export async function listAllFeatures() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(features);
}

/** Todos os planos, cada um já com sua lista de featureIds e limites — pronto pra exibir/comparar. */
export async function listPlansWithFeaturesAndLimits() {
  const db = await getDb();
  if (!db) return [];
  const allPlans = await db.select().from(plans).orderBy(plans.position);
  if (!allPlans.length) return [];
  const planIds = allPlans.map(plan => plan.id);
  const [allPlanFeatures, allPlanLimits] = await Promise.all([
    db.select().from(planFeatures).where(inArray(planFeatures.planId, planIds)),
    db.select().from(planLimits).where(inArray(planLimits.planId, planIds)),
  ]);
  return allPlans.map(plan => ({
    ...plan,
    features: allPlanFeatures.filter(row => row.planId === plan.id).map(row => row.featureId),
    limits: Object.fromEntries(allPlanLimits.filter(row => row.planId === plan.id).map(row => [row.resourceKey, row.limitValue])),
  }));
}

/** id informado = UPDATE (key não é alterada); sem id = INSERT (key obrigatório, validado no router). */
export async function savePlan(input: { id?: number; key?: string; name: string; priceCents: number; currency?: string; position: number; active: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const values = {
    name: input.name.trim(),
    priceCents: input.priceCents,
    currency: input.currency?.trim() || "BRL",
    position: input.position,
    active: input.active,
    updatedAt: now,
  };
  if (input.id) {
    await db.update(plans).set(values).where(eq(plans.id, input.id));
    return { id: input.id };
  }
  if (!input.key) throw new Error("key é obrigatório para criar um novo plano");
  const result = await db.insert(plans).values({ ...values, key: input.key as (typeof plans.key.enumValues)[number], createdAt: now });
  return { id: Number(result[0].insertId) };
}

/** featureId é a PK — cria a feature se não existir, ou atualiza nome/descrição/categoria se já existir. */
export async function saveFeature(input: { featureId: string; name: string; description?: string; category?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const featureId = input.featureId.trim();
  const values = { name: input.name.trim(), description: input.description?.trim() || null, category: input.category?.trim() || null, updatedAt: now };
  await db.insert(features).values({ featureId, ...values, createdAt: now }).onDuplicateKeyUpdate({ set: values });
  return { featureId };
}

/** Liga/desliga uma feature pra um plano (linha da junção plan_features). */
export async function setPlanFeature(planId: number, featureId: string, enabled: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  if (enabled) {
    const [existing] = await db.select().from(planFeatures).where(and(eq(planFeatures.planId, planId), eq(planFeatures.featureId, featureId))).limit(1);
    if (!existing) await db.insert(planFeatures).values({ planId, featureId, createdAt: Date.now() });
  } else {
    await db.delete(planFeatures).where(and(eq(planFeatures.planId, planId), eq(planFeatures.featureId, featureId)));
  }
  return { success: true };
}

/** Upsert de limite por plano+recurso. limitValue null = ilimitado (definido explicitamente, não "sem linha"). */
export async function setPlanLimit(planId: number, resourceKey: string, limitValue: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  await db
    .insert(planLimits)
    .values({ planId, resourceKey, limitValue, createdAt: now, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { limitValue, updatedAt: now } });
  return { success: true };
}
