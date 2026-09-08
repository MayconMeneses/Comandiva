import { getLocalUsageCounts, getOrCreateLicenseCache, upsertLicenseCache } from "../db";
import { cached } from "../db/client";
import { ENV } from "./env";

export const FEATURE_IDS = [
  "tables_qr",
  "call_waiter",
  "request_bill",
  "extra_rounds",
  "advanced_reports",
  "custom_domain",
  "advanced_branding",
] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export type LicenseSnapshot = {
  planKey: string;
  planName: string;
  status: string;
  features: FeatureId[];
  limits: Record<string, number | null>;
  lockedFeatures: Record<string, { requiredPlanKey: string; requiredPlanName: string }>;
  currentPeriodEnd: number | null;
  syncedAt: number;
  lastSyncOk: boolean;
  // Downgrade agendado (self-service) — só informativo pra UI ("Meu Plano"
  // avisa o que vai mudar e quando); nunca usado pra decidir acesso agora
  // (features/limits acima já refletem o plano ATUAL, que continua valendo
  // até currentPeriodEnd).
  scheduledPlanKey: string | null;
  scheduledPlanName: string | null;
};

// Usado quando a camada de licenciamento está desligada (env vars em branco)
// ou quando ainda não existe nenhuma sincronização no cache local — nunca
// bloqueamos por falta de configuração/infra da própria camada de plano.
const PERMISSIVE_DEFAULT: LicenseSnapshot = {
  planKey: "unconfigured",
  planName: "Sem licenciamento configurado",
  status: "unconfigured",
  features: [...FEATURE_IDS],
  limits: {},
  lockedFeatures: {},
  currentPeriodEnd: null,
  syncedAt: 0,
  lastSyncOk: false,
  scheduledPlanKey: null,
  scheduledPlanName: null,
};

function buildSnapshot(row: Awaited<ReturnType<typeof getOrCreateLicenseCache>>): LicenseSnapshot {
  if (!row) return PERMISSIVE_DEFAULT;
  return {
    planKey: row.planKey,
    planName: row.planName,
    status: row.status,
    features: JSON.parse(row.featuresJson ?? "[]"),
    limits: JSON.parse(row.limitsJson ?? "{}"),
    lockedFeatures: JSON.parse(row.lockedFeaturesJson ?? "{}"),
    currentPeriodEnd: row.currentPeriodEnd,
    syncedAt: row.syncedAt ?? 0,
    lastSyncOk: row.lastSyncOk,
    scheduledPlanKey: row.scheduledPlanKey ?? null,
    scheduledPlanName: row.scheduledPlanName ?? null,
  };
}

/** Sem cache — usada logo após forçar uma sincronização, onde o estado tem que refletir o resultado exato dessa sincronização, não um valor de alguns segundos atrás. */
async function getFreshLicenseSnapshot(): Promise<LicenseSnapshot> {
  return buildSnapshot(await getOrCreateLicenseCache());
}

// Lida em `featureProcedure`/`requireFeature` a cada chamada de rota com
// recurso pago (ex.: ações de mesa via QR Code) — o cache local só é
// atualizado a cada `LICENSE_SYNC_INTERVAL_MS` (minutos) de qualquer forma,
// então alguns segundos de cache aqui não trocam nenhum comportamento visível
// e eliminam um SELECT do MySQL por requisição.
const getCachedLicenseSnapshot = cached(5_000, getFreshLicenseSnapshot);

export async function getLicenseSnapshot(): Promise<LicenseSnapshot> {
  return getCachedLicenseSnapshot();
}

export async function getLicenseUsage() {
  return getLocalUsageCounts();
}

async function syncLicenseOnce(): Promise<void> {
  if (!ENV.saasCoreUrl || !ENV.saasCoreApiKey) return; // camada desligada de propósito
  try {
    const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/sync.mySnapshot`, {
      headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}` },
    });
    if (!response.ok) throw new Error(`saas-core respondeu ${response.status}`);
    const body = (await response.json()) as {
      result: { data: { planKey: string; planName: string; status: string; features: string[]; limits: Record<string, number | null>; lockedFeatures: LicenseSnapshot["lockedFeatures"]; currentPeriodEnd: number; scheduledPlanKey: string | null; scheduledPlanName: string | null } };
    };
    const snapshot = body.result.data;
    await upsertLicenseCache({
      planKey: snapshot.planKey,
      planName: snapshot.planName,
      status: snapshot.status,
      featuresJson: JSON.stringify(snapshot.features),
      limitsJson: JSON.stringify(snapshot.limits),
      lockedFeaturesJson: JSON.stringify(snapshot.lockedFeatures),
      currentPeriodEnd: snapshot.currentPeriodEnd,
      syncedAt: Date.now(),
      scheduledPlanKey: snapshot.scheduledPlanKey ?? null,
      scheduledPlanName: snapshot.scheduledPlanName ?? null,
    });
  } catch (error) {
    // Best-effort: nunca apaga/reseta o cache — é assim que o fail-open
    // acontece (mantém o último estado bom conhecido).
    console.warn("[license] Falha ao sincronizar com saas-core — mantendo último estado conhecido:", error);
  }
}

export async function forceSyncLicense(): Promise<LicenseSnapshot> {
  await syncLicenseOnce();
  return getFreshLicenseSnapshot();
}

export type PlanCatalogEntry = {
  key: string;
  name: string;
  priceCents: number;
  currency: string;
  position: number;
  features: FeatureId[];
  limits: Record<string, number | null>;
};

/**
 * Catálogo de todos os planos (não só o atual) — buscado sob demanda (sem
 * cache local, ao contrário do snapshot acima) porque só é usado quando o
 * admin abre a tela "Meu Plano", tráfego baixo demais pra justificar cache.
 */
export async function fetchPlanCatalog(): Promise<PlanCatalogEntry[]> {
  if (!ENV.saasCoreUrl || !ENV.saasCoreApiKey) return [];
  try {
    const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/sync.plans`, {
      headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}` },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { result: { data: PlanCatalogEntry[] } };
    return body.result.data;
  } catch (error) {
    console.warn("[license] Falha ao buscar catálogo de planos:", error);
    return [];
  }
}

if (ENV.saasCoreUrl && ENV.saasCoreApiKey) {
  void syncLicenseOnce();
  setInterval(() => void syncLicenseOnce(), ENV.licenseSyncIntervalMs).unref();
}
