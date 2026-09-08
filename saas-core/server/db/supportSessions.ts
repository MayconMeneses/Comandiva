import { and, eq, isNull } from "drizzle-orm";
import { generateSupportToken } from "../_core/supportToken";
import { ENV } from "../_core/env";
import { getDb } from "./client";
import { supportSessions } from "../../drizzle/schema";

export async function createSupportSession(input: { restaurantId: number; platformAdminId: number; issuedFromIp?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const { token, tokenHash } = generateSupportToken();
  const now = Date.now();
  const expiresAt = now + ENV.supportSessionTtlMs;
  await db.insert(supportSessions).values({
    restaurantId: input.restaurantId,
    platformAdminId: input.platformAdminId,
    tokenHash,
    issuedAt: now,
    expiresAt,
    issuedFromIp: input.issuedFromIp,
  });
  return { token, expiresAt };
}

/**
 * Sempre filtrado por restaurantId (resolvido da própria API key de quem
 * chama, nunca de um valor enviado no input) — é isso que impede o
 * restaurante B de resgatar/encerrar um token emitido pra restaurante A.
 */
export async function getOwnSupportSession(restaurantId: number, tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [session] = await db
    .select()
    .from(supportSessions)
    .where(and(eq(supportSessions.tokenHash, tokenHash), eq(supportSessions.restaurantId, restaurantId)))
    .limit(1);
  return session;
}

export async function getSupportSessionById(restaurantId: number, supportSessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [session] = await db
    .select()
    .from(supportSessions)
    .where(and(eq(supportSessions.id, supportSessionId), eq(supportSessions.restaurantId, restaurantId)))
    .limit(1);
  return session;
}

/** Compare-and-swap: só marca usado se ainda estiver null — garante uso único mesmo sob chamadas concorrentes pro mesmo token. */
export async function markSupportSessionUsed(supportSessionId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db
    .update(supportSessions)
    .set({ usedAt: Date.now() })
    .where(and(eq(supportSessions.id, supportSessionId), isNull(supportSessions.usedAt)));
  return result[0].affectedRows === 1;
}

export async function markSupportSessionEnded(supportSessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(supportSessions).set({ endedAt: Date.now() }).where(eq(supportSessions.id, supportSessionId));
}
