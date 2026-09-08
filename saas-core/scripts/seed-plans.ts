import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { features, planFeatures, planLimits, plans, type PlanKey } from "../drizzle/schema";

/**
 * Seed idempotente dos planos/features/limites reais do SaaS — seguro
 * rodar de novo a qualquer momento (upsert por chave natural), mesmo padrão
 * de scripts/seed-cardapio-pubx.ts no app principal. Roda em todo boot do
 * container (ver infra/entrypoint.sh).
 */

const PLANS: { key: PlanKey; name: string; priceCents: number; position: number }[] = [
  { key: "essencial", name: "Essencial", priceCents: 14990, position: 1 },
  { key: "profissional", name: "Profissional", priceCents: 24990, position: 2 },
  { key: "premium", name: "Premium", priceCents: 29990, position: 3 },
];

const FEATURES: { featureId: string; name: string; category: string; minPlan: PlanKey }[] = [
  { featureId: "tables_qr", name: "Mesas / QR Code", category: "mesas", minPlan: "profissional" },
  { featureId: "call_waiter", name: "Chamar garçom", category: "mesas", minPlan: "profissional" },
  { featureId: "request_bill", name: "Solicitar conta", category: "mesas", minPlan: "profissional" },
  { featureId: "extra_rounds", name: "Rodadas extras", category: "mesas", minPlan: "profissional" },
  { featureId: "advanced_reports", name: "Relatórios avançados", category: "relatorios", minPlan: "profissional" },
  { featureId: "custom_domain", name: "Domínio próprio", category: "branding", minPlan: "premium" },
  { featureId: "advanced_branding", name: "Personalização visual avançada", category: "branding", minPlan: "premium" },
];

const LIMITS: Record<PlanKey, Record<"users" | "tables", number | null>> = {
  essencial: { users: 3, tables: 0 },
  profissional: { users: 10, tables: 30 },
  premium: { users: null, tables: null },
};

async function seedPlans() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();

  for (const plan of PLANS) {
    await db
      .insert(plans)
      .values({ ...plan, currency: "BRL", active: true, createdAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { name: plan.name, priceCents: plan.priceCents, position: plan.position, updatedAt: now } });
  }
  for (const feature of FEATURES) {
    await db
      .insert(features)
      .values({ featureId: feature.featureId, name: feature.name, category: feature.category, createdAt: now, updatedAt: now })
      .onDuplicateKeyUpdate({ set: { name: feature.name, category: feature.category, updatedAt: now } });
  }

  // Resolve os ids reais (upsert não garante que insertId seja o existente
  // em todo driver/versão — buscar de novo é sempre correto).
  const savedPlans = await db.select().from(plans);
  const plansByKey = new Map(savedPlans.map(plan => [plan.key, plan]));

  for (const plan of savedPlans) {
    for (const feature of FEATURES) {
      const minPlan = plansByKey.get(feature.minPlan);
      if (!minPlan || plan.position < minPlan.position) continue;
      await db
        .insert(planFeatures)
        .values({ planId: plan.id, featureId: feature.featureId, createdAt: now })
        .onDuplicateKeyUpdate({ set: { createdAt: now } });
    }
    const limits = LIMITS[plan.key];
    for (const [resourceKey, limitValue] of Object.entries(limits)) {
      await db
        .insert(planLimits)
        .values({ planId: plan.id, resourceKey, limitValue, createdAt: now, updatedAt: now })
        .onDuplicateKeyUpdate({ set: { limitValue, updatedAt: now } });
    }
    // Remove vínculos de feature que não deveriam mais existir pro plano
    // (ex.: uma feature que mudou de minPlan num seed futuro).
    const allowedFeatureIds = FEATURES.filter(feature => {
      const minPlan = plansByKey.get(feature.minPlan);
      return minPlan && plan.position >= minPlan.position;
    }).map(feature => feature.featureId);
    const existing = await db.select().from(planFeatures).where(eq(planFeatures.planId, plan.id));
    for (const row of existing) {
      if (!allowedFeatureIds.includes(row.featureId)) {
        await db.delete(planFeatures).where(eq(planFeatures.id, row.id));
      }
    }
  }

  console.log(`[seed-plans] ${savedPlans.length} planos, ${FEATURES.length} features sincronizados.`);
}

seedPlans()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[seed-plans] Falhou:", error);
    process.exit(1);
  });
