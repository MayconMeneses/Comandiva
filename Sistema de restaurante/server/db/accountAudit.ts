import { desc } from "drizzle-orm";
import { accountAuditLog } from "../../drizzle/schema";
import { getDb } from "./client";

/**
 * Grava uma ação administrativa sensível (equipe/permissões, gateway de
 * pagamento, chave Pix) — ver drizzle/schema.ts::accountAuditLog. NUNCA
 * passe o valor de uma credencial/senha em `before`/`after`: só campos que
 * são seguros de aparecer na tela de Auditoria (ex.: `{ changed: true }`
 * pra uma chave, nunca a chave em si).
 */
export async function recordAccountAudit(input: {
  actorUserId: number | null;
  actorName: string;
  action: string;
  entityType?: string;
  entityId?: number;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(accountAuditLog).values({
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    beforeJson: input.before !== undefined ? JSON.stringify(input.before) : null,
    afterJson: input.after !== undefined ? JSON.stringify(input.after) : null,
    ip: input.ip ?? null,
    createdAt: Date.now(),
  });
}

export type AccountAuditEntry = typeof accountAuditLog.$inferSelect;

export async function listAccountAuditEntries(limit: number): Promise<AccountAuditEntry[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accountAuditLog).orderBy(desc(accountAuditLog.createdAt)).limit(limit);
}
