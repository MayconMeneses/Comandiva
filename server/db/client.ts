import { drizzle } from "drizzle-orm/mysql2";

let _db: ReturnType<typeof drizzle> | null = null;

export type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
// Aceita tanto a conexão normal quanto o `tx` passado dentro de
// db.transaction(async tx => ...) — os dois implementam os mesmos métodos de
// query builder (.select()/.insert()/...), só o `tx` não tem `$client` (a
// pool inteira, que não faz sentido expor de dentro de uma transação).
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Passar a DATABASE_URL direto pro drizzle() cria um pool com o padrão do
      // mysql2 (apenas 10 conexões) — muito pouco sob tráfego concorrente alto.
      // DB_POOL_SIZE permite ajustar isso por ambiente sem mexer no código.
      const connectionLimit = Number(process.env.DB_POOL_SIZE) || 20;
      _db = drizzle({ connection: { uri: process.env.DATABASE_URL, connectionLimit, queueLimit: 0 } });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Cache simples em memória com TTL, para leituras públicas de alto tráfego
 * (cardápio, promoções, eventos) que raramente mudam. Compartilha a mesma
 * promise entre chamadas concorrentes durante o cache frio, evitando que um
 * pico de acessos simultâneos dispare a mesma consulta dezenas de vezes.
 */
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

export const CATALOG_CACHE_TTL_MS = 15_000;
