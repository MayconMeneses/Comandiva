import { eq } from "drizzle-orm";
import { getDb, type DbOrTx } from "./client";
import { restaurantStaffCredentials, restaurantTables, subscriptionCache } from "../../drizzle/schema";

/**
 * Sempre existe exatamente 1 linha (singleton), igual restaurantSettings —
 * criada na primeira leitura se ainda não houver nenhuma. Aceita um `tx`
 * opcional pra poder rodar dentro de uma transação já aberta pelo chamador
 * (ver `lockLicenseSingletonRow`, usada por `assertWithinPlanLimitAndInsert`).
 */
export async function getOrCreateLicenseCache(conn?: DbOrTx) {
  const db = conn ?? await getDb();
  if (!db) return undefined;
  const [existing] = await db.select().from(subscriptionCache).limit(1);
  if (existing) return existing;

  const now = Date.now();
  await db.insert(subscriptionCache).values({
    planKey: "essencial",
    planName: "Essencial",
    status: "trial",
    featuresJson: "[]",
    limitsJson: "{}",
    lockedFeaturesJson: "{}",
    lastSyncOk: false,
    updatedAt: now,
  });
  const [created] = await db.select().from(subscriptionCache).limit(1);
  return created;
}

/**
 * Trava a única linha de `subscriptionCache` (SELECT ... FOR UPDATE) — usada
 * como mutex pra serializar checagem+escrita de limite de plano concorrente
 * (ver auditoria V-24: duas requisições simultâneas de criar conta/mesa,
 * ambas com o uso já no limite-1, passavam na checagem e ambas inseriam).
 * Sempre existe exatamente 1 linha singleton, então travar essa linha não
 * tem o problema de "phantom row" que travar as linhas contadas teria — só
 * funciona de dentro de `db.transaction()`, já que FOR UPDATE fora de uma
 * transação não retém o lock depois do SELECT.
 */
export async function lockLicenseSingletonRow(tx: DbOrTx) {
  await getOrCreateLicenseCache(tx);
  await tx.select({ id: subscriptionCache.id }).from(subscriptionCache).limit(1).for("update");
}

export async function upsertLicenseCache(data: {
  planKey: string;
  planName: string;
  status: string;
  featuresJson: string;
  limitsJson: string;
  lockedFeaturesJson: string;
  currentPeriodEnd: number | null;
  syncedAt: number;
  scheduledPlanKey: string | null;
  scheduledPlanName: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getOrCreateLicenseCache();
  if (!existing) return;
  await db
    .update(subscriptionCache)
    .set({ ...data, lastSyncOk: true, updatedAt: Date.now() })
    .where(eq(subscriptionCache.id, existing.id));
}

/** Uso atual do deployment nos recursos com limite por plano (staff/mesas ativos). Aceita `tx` opcional pra contar dentro da mesma transação que travou `lockLicenseSingletonRow`. */
export async function getLocalUsageCounts(conn?: DbOrTx) {
  const db = conn ?? await getDb();
  if (!db) return { users: 0, tables: 0 };
  const [activeStaff, activeTables] = await Promise.all([
    db.select().from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.active, true)),
    db.select().from(restaurantTables).where(eq(restaurantTables.active, true)),
  ]);
  return { users: activeStaff.length, tables: activeTables.length };
}
