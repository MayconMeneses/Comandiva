import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { restaurantStaffCredentials, restaurantTables, subscriptionCache } from "../../drizzle/schema";

/** Sempre existe exatamente 1 linha (singleton), igual restaurantSettings — criada na primeira leitura se ainda não houver nenhuma. */
export async function getOrCreateLicenseCache() {
  const db = await getDb();
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

/** Uso atual do deployment nos recursos com limite por plano (staff/mesas ativos). */
export async function getLocalUsageCounts() {
  const db = await getDb();
  if (!db) return { users: 0, tables: 0 };
  const [activeStaff, activeTables] = await Promise.all([
    db.select().from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.active, true)),
    db.select().from(restaurantTables).where(eq(restaurantTables.active, true)),
  ]);
  return { users: activeStaff.length, tables: activeTables.length };
}
