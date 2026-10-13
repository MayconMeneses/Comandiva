import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connectionLimit = Number(process.env.DB_POOL_SIZE) || 10;
      _db = drizzle({ connection: { uri: process.env.DATABASE_URL, connectionLimit, queueLimit: 0 } });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Mesmo padrão já usado no app principal (server/db/client.ts::cached) —
// cache em memória com TTL curto pra dado quase-estático lido com muita
// frequência (planos/features consultados a cada sync de licença de CADA
// restaurante-cliente, e a cada load da página pública de planos). Dedupe de
// chamadas concorrentes (`pending`) evita disparar N queries idênticas se N
// requisições chegarem antes da primeira responder.
export function cached<T>(ttlMs: number, fn: () => Promise<T>): () => Promise<T> {
  let value: { data: T; expiresAt: number } | null = null;
  let pending: Promise<T> | null = null;
  return () => {
    const now = Date.now();
    if (value && now < value.expiresAt) return Promise.resolve(value.data);
    if (pending) return pending;
    pending = fn()
      .then(data => {
        value = { data, expiresAt: Date.now() + ttlMs };
        pending = null;
        return data;
      })
      .catch(error => {
        pending = null;
        throw error;
      });
    return pending;
  };
}

export const PLANS_CACHE_TTL_MS = 30_000;
