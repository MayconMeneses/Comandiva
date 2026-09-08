import { and, desc, eq, lt } from "drizzle-orm";
import { getDb } from "./client";
import { platformAuditLog } from "../../drizzle/schema";

export async function recordPlatformAuditLog(input: {
  actorAdminId?: number | null;
  actorLabel: string;
  action: string;
  entityType?: string;
  entityId?: number;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.insert(platformAuditLog).values({
    actorAdminId: input.actorAdminId ?? null,
    actorLabel: input.actorLabel,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.before !== undefined ? JSON.stringify(input.before) : null,
    afterJson: input.after !== undefined ? JSON.stringify(input.after) : null,
    ip: input.ip,
    createdAt: Date.now(),
  });
}

export async function listPlatformAuditLog(filters: { action?: string; entityType?: string; entityId?: number; actorAdminId?: number; limit?: number; beforeId?: number } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    filters.action ? eq(platformAuditLog.action, filters.action) : undefined,
    filters.entityType ? eq(platformAuditLog.entityType, filters.entityType) : undefined,
    filters.entityId !== undefined ? eq(platformAuditLog.entityId, filters.entityId) : undefined,
    filters.actorAdminId !== undefined ? eq(platformAuditLog.actorAdminId, filters.actorAdminId) : undefined,
    filters.beforeId !== undefined ? lt(platformAuditLog.id, filters.beforeId) : undefined,
  ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
  return db
    .select()
    .from(platformAuditLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(platformAuditLog.id))
    .limit(Math.min(filters.limit ?? 50, 200));
}
