import { and, asc, eq, inArray } from "drizzle-orm";
import { restaurantTables, tableServiceRequests, tableSessions } from "../../drizzle/schema";
import { getDb } from "./client";

// ---- Chamados (chamar garçom) ----

/** Idempotente: não cria um segundo chamado enquanto já existir um pendente na mesma comanda. */
export async function createServiceRequest(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select().from(tableServiceRequests).where(and(eq(tableServiceRequests.tableSessionId, sessionId), eq(tableServiceRequests.status, "PENDING"))).limit(1);
  if (existing) return existing.id;
  const result = await db.insert(tableServiceRequests).values({ tableSessionId: sessionId, status: "PENDING", createdAt: Date.now() });
  return Number(result[0].insertId);
}

export async function listPendingServiceRequests() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const pending = await db.select().from(tableServiceRequests).where(eq(tableServiceRequests.status, "PENDING")).orderBy(asc(tableServiceRequests.createdAt));
  if (!pending.length) return [];
  const sessionIds = pending.map(request => request.tableSessionId);
  const sessions = await db.select().from(tableSessions).where(inArray(tableSessions.id, sessionIds));
  const tableIds = sessions.map(session => session.tableId);
  const tables = tableIds.length ? await db.select().from(restaurantTables).where(inArray(restaurantTables.id, tableIds)) : [];
  return pending.map(request => {
    const session = sessions.find(candidate => candidate.id === request.tableSessionId);
    const table = tables.find(candidate => candidate.id === session?.tableId);
    return { ...request, tableLabel: table?.label ?? "Mesa" };
  });
}

export async function resolveServiceRequest(id: number, status: "ACKNOWLEDGED" | "DONE" | "CANCELLED", resolvedByUserId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(tableServiceRequests).set({ status, resolvedAt: Date.now(), resolvedByUserId }).where(eq(tableServiceRequests.id, id));
}
