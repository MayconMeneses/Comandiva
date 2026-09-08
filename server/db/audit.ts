import { desc, inArray } from "drizzle-orm";
import { orderChangeLogs, orderStatusHistory, orders, users } from "../../drizzle/schema";
import { getDb } from "./client";

export type AuditEntry =
  | { kind: "STATUS"; id: number; orderId: number; orderPublicCode: string; actorName: string | null; status: string; note: string | null; createdAt: number }
  | { kind: "CHANGE"; id: number; orderId: number; orderPublicCode: string; actorName: string | null; changeType: string; details: string; createdAt: number };

/**
 * Linha do tempo unificada de order_status_history + order_change_logs (as
 * duas tabelas append-only de auditoria de pedido, ver drizzle/0030_*), com
 * nome de quem agiu e código do pedido já resolvidos — pra tela de
 * "Auditoria" do admin (ver client/src/components/admin/AuditLog.tsx). Só 4
 * consultas no total (2 tabelas de log + orders + users em lote via
 * inArray), independente do tamanho de `limit` — mesmo padrão de
 * server/db/orders.ts::attachOrderDetails.
 */
export async function getRecentAuditEntries(limit: number): Promise<AuditEntry[]> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const [statusRows, changeRows] = await Promise.all([
    db.select().from(orderStatusHistory).orderBy(desc(orderStatusHistory.createdAt)).limit(limit),
    db.select().from(orderChangeLogs).orderBy(desc(orderChangeLogs.createdAt)).limit(limit),
  ]);

  const merged = [...statusRows.map(row => ({ ...row, kind: "STATUS" as const })), ...changeRows.map(row => ({ ...row, kind: "CHANGE" as const }))]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
  if (!merged.length) return [];

  const orderIds = [...new Set(merged.map(row => row.orderId))];
  const actorIds = [...new Set(merged.map(row => row.changedByUserId).filter((id): id is number => id != null))];
  const [orderRows, actorRows] = await Promise.all([
    db.select({ id: orders.id, publicCode: orders.publicCode }).from(orders).where(inArray(orders.id, orderIds)),
    actorIds.length ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds)) : Promise.resolve([]),
  ]);
  const publicCodeByOrderId = new Map(orderRows.map(row => [row.id, row.publicCode]));
  const actorNameById = new Map(actorRows.map(row => [row.id, row.name]));

  return merged.map(row => {
    const orderPublicCode = publicCodeByOrderId.get(row.orderId) ?? "—";
    const actorName = row.changedByUserId != null ? (actorNameById.get(row.changedByUserId) ?? "Conta removida") : null;
    return row.kind === "STATUS"
      ? { kind: "STATUS", id: row.id, orderId: row.orderId, orderPublicCode, actorName, status: row.status, note: row.note, createdAt: row.createdAt }
      : { kind: "CHANGE", id: row.id, orderId: row.orderId, orderPublicCode, actorName, changeType: row.changeType, details: row.details, createdAt: row.createdAt };
  });
}
