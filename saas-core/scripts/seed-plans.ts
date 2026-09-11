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
  { key: "essencial", name: "Essencial", priceCents: 9999, position: 1 },
  { key: "profissional", name: "Profissional", priceCents: 19999, position: 2 },
  { key: "premium", name: "Premium", priceCents: 24999, position: 3 },
];

const FEATURES: { featureId: string; name: string; category: string; minPlan: PlanKey }[] = [
  { featureId: "tables_qr", name: "Mesas / QR Code", category: "mesas", minPlan: "profissional" },
  { featureId: "call_waiter", name: "Chamar garçom", category: "mesas", minPlan: "profissional" },
  { featureId: "request_bill", name: "Solicitar conta", category: "mesas", minPlan: "profissional" },
  { featureId: "extra_rounds", name: "Rodadas extras", category: "mesas", minPlan: "profissional" },
  // Promoções: ferramenta de crescimento/marketing — natural do plano em
  // que o dono já está pensando em mesas/salão, junto com o resto do
  // cluster "operação mais madura" (ver pedido do dono, 2026-09-10).
  { featureId: "promotions", name: "Promoções e combos", category: "marketing", minPlan: "profissional" },
  // Eventos e Fiscal ficam reservados pro topo: eventos é uma ferramenta de
  // marketing mais avançada (divulgação), fiscal é conformidade tributária
  // de verdade (CNPJ, certificado digital, NFC-e) — ambos fazem sentido
  // como diferenciais do plano mais completo, não como parte do básico.
  { featureId: "events", name: "Eventos", category: "marketing", minPlan: "premium" },
  { featureId: "fiscal", name: "Nota fiscal (NFC-e)", category: "fiscal", minPlan: "premium" },
];

const LIMITS: Record<PlanKey, Record<"users" | "tables", number | null>> = {
  essencial: { users: 3, tables: 0 },
  profissional: { users: 8, tables: 12 },
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
