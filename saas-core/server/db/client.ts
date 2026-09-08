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
