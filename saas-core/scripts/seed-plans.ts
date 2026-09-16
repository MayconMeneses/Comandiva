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
  { key: "essencial", name: "Entrada", priceCents: 9999, position: 1 },
  { key: "profissional", name: "Profissional", priceCents: 19999, position: 2 },
  { key: "premium", name: "Premium", priceCents: 24999, position: 3 },
];

// Reestruturação 2026-09-11 (pedido do dono): NFC-e deixou de ser
// diferencial de plano — passa a valer pros três, a diferenciação comercial
// agora é só por capacidade/operação/gestão. Cozinha, comandas, reservas,
// app da equipe e relatórios completos entraram no Profissional; gestão
// avançada de equipe e auditoria entraram no Premium junto de eventos e
// relatórios avançados (que já eram Premium).
const FEATURES: { featureId: string; name: string; category: string; minPlan: PlanKey }[] = [
  { featureId: "kitchen", name: "Cozinha / Kanban de pedidos", category: "operacao", minPlan: "profissional" },
  { featureId: "tables_qr", name: "Mesas / QR Code", category: "mesas", minPlan: "profissional" },
  { featureId: "call_waiter", name: "Chamar garçom", category: "mesas", minPlan: "profissional" },
  { featureId: "request_bill", name: "Solicitar conta", category: "mesas", minPlan: "profissional" },
  { featureId: "extra_rounds", name: "Rodadas extras", category: "mesas", minPlan: "profissional" },
  { featureId: "commands", name: "Comandas e divisão de conta", category: "mesas", minPlan: "profissional" },
  { featureId: "reservations", name: "Reservas", category: "mesas", minPlan: "profissional" },
  { featureId: "team_app", name: "App da equipe (celular/tablet)", category: "operacao", minPlan: "profissional" },
  { featureId: "promotions", name: "Promoções e combos", category: "marketing", minPlan: "profissional" },
  { featureId: "reports_complete", name: "Relatórios completos", category: "relatorios", minPlan: "profissional" },
  { featureId: "custom_theme", name: "Tema de cor personalizado", category: "marketing", minPlan: "profissional" },
  // Eventos, relatórios avançados, gestão avançada de equipe e auditoria
  // ficam reservados pro topo — diferenciais do plano mais completo.
  { featureId: "events", name: "Eventos", category: "marketing", minPlan: "premium" },
  { featureId: "reports_advanced", name: "Relatórios avançados", category: "relatorios", minPlan: "premium" },
  { featureId: "advanced_team", name: "Gestão avançada da equipe", category: "equipe", minPlan: "premium" },
  { featureId: "audit", name: "Auditoria", category: "seguranca", minPlan: "premium" },
  // Fiscal (NFC-e) agora é base — disponível em todos os planos, inclusive
  // o de entrada.
  { featureId: "fiscal", name: "Nota fiscal (NFC-e)", category: "fiscal", minPlan: "essencial" },
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
