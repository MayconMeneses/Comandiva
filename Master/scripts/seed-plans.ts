import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { features, planFeatures, planLimits, plans, type PlanKey } from "../drizzle/schema";

/**
 * Seed idempotente dos planos/features/limites do SaaS — seguro rodar de novo
 * a qualquer momento. Roda em todo boot do container (infra/entrypoint.sh).
 *
 * IMPORTANTE: este script só CRIA o que ainda não existe (valores iniciais).
 * Depois de criado, a fonte da verdade é o Painel Master: preço, posição,
 * manutenção, limites e recursos de cada plano editados lá NÃO são
 * sobrescritos por este seed (antes eram, e cada deploy desfazia a edição).
 * Um recurso novo do catálogo entra nos planos conforme o `minPlan` só na
 * primeira vez em que ele é criado.
 */

// Valores iniciais. Preços reduzidos a pedido do dono em 2026-09-29 (eram 9999/19999/24999).
// maintenanceCents: manutenção avulsa por acionamento; nulo = inclusa (Entrada: R$ 50 desde 2026-10-16).
const PLANS: { key: PlanKey; name: string; priceCents: number; position: number; maintenanceCents: number | null }[] = [
  { key: "essencial", name: "Entrada", priceCents: 9990, position: 1, maintenanceCents: 5000 },
  { key: "profissional", name: "Profissional", priceCents: 14990, position: 2, maintenanceCents: null },
  { key: "premium", name: "Premium", priceCents: 19990, position: 3, maintenanceCents: null },
];

// Reestruturação 2026-09-11 (pedido do dono): a diferenciação comercial é
// só por capacidade/operação/gestão. Cozinha, comandas, reservas,
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
  // Virou base pra todos os planos 2026-10-01 (pedido do dono, revertendo a
  // decisão de 2026-09-24 que tinha feito isso virar diferencial comercial)
  // — resiliência de rede não é algo que faça sentido negar pro plano de entrada.
  { featureId: "offline_resilience", name: "Pedido resistente a conexão instável", category: "operacao", minPlan: "essencial" },
  // Eventos, relatórios avançados, gestão avançada de equipe e auditoria
  // ficam reservados pro topo — diferenciais do plano mais completo.
  { featureId: "events", name: "Eventos", category: "marketing", minPlan: "premium" },
  { featureId: "reports_advanced", name: "Relatórios avançados", category: "relatorios", minPlan: "premium" },
  { featureId: "advanced_team", name: "Gestão avançada da equipe", category: "equipe", minPlan: "premium" },
  { featureId: "audit", name: "Auditoria", category: "seguranca", minPlan: "premium" },
];

// Recursos que saíram do produto (decisão do dono, 2026-10-07: restaurante não
// usa nota fiscal). O seed só sincroniza o que está em FEATURES, então sem esta
// lista a linha continuaria na tabela comparativa pública de planos.
const RETIRED_FEATURE_IDS = ["fiscal"];

const LIMITS: Record<PlanKey, Record<"users" | "tables", number | null>> = {
  essencial: { users: 3, tables: 0 },
  profissional: { users: 8, tables: 12 },
  premium: { users: null, tables: null },
};

async function seedPlans() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();

  // Só cria o que falta: nunca atualiza linha existente (a edição do Painel Master vale).
  const existingPlanKeys = new Set((await db.select({ key: plans.key }).from(plans)).map(row => row.key));
  for (const plan of PLANS) {
    if (existingPlanKeys.has(plan.key)) continue;
    await db.insert(plans).values({ ...plan, currency: "BRL", active: true, createdAt: now, updatedAt: now });
  }

  const existingFeatureIds = new Set((await db.select({ featureId: features.featureId }).from(features)).map(row => row.featureId));
  const newFeatures = FEATURES.filter(feature => !existingFeatureIds.has(feature.featureId));
  for (const feature of newFeatures) {
    await db.insert(features).values({ featureId: feature.featureId, name: feature.name, category: feature.category, createdAt: now, updatedAt: now });
  }

  // Resolve os ids reais (buscar de novo é sempre correto, qualquer driver/versão).
  const savedPlans = await db.select().from(plans);
  const plansByKey = new Map(savedPlans.map(plan => [plan.key, plan]));

  for (const plan of savedPlans) {
    // Recurso recém-criado entra nos planos a partir do minPlan; recurso que já existia
    // não é tocado (a marcação feita no Painel Master é mantida).
    for (const feature of newFeatures) {
      const minPlan = plansByKey.get(feature.minPlan);
      if (!minPlan || plan.position < minPlan.position) continue;
      await db
        .insert(planFeatures)
        .values({ planId: plan.id, featureId: feature.featureId, createdAt: now })
        .onDuplicateKeyUpdate({ set: { createdAt: now } });
    }
    // Limite inicial só se ainda não houver linha para o plano+recurso.
    const existingLimits = new Set(
      (await db.select({ resourceKey: planLimits.resourceKey }).from(planLimits).where(eq(planLimits.planId, plan.id))).map(row => row.resourceKey),
    );
    for (const [resourceKey, limitValue] of Object.entries(LIMITS[plan.key])) {
      if (existingLimits.has(resourceKey)) continue;
      await db.insert(planLimits).values({ planId: plan.id, resourceKey, limitValue, createdAt: now, updatedAt: now });
    }
  }

  for (const featureId of RETIRED_FEATURE_IDS) {
    await db.delete(planFeatures).where(eq(planFeatures.featureId, featureId));
    await db.delete(features).where(eq(features.featureId, featureId));
  }

  console.log(`[seed-plans] ${savedPlans.length} planos, ${FEATURES.length} features sincronizados.`);
}

seedPlans()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[seed-plans] Falhou:", error);
    process.exit(1);
  });
