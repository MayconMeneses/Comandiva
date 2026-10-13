import { and, asc, eq } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { restaurantTables } from "../../drizzle/schema";
import { getCustomerByPhone, saveCustomerProfile } from "./customers";
import { getDb, type DbOrTx } from "./client";

const generateQrToken = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789", 14);

// Cliente sentinela pra rodadas de mesa pedidas sem telefone informado (fluxo
// QR Code é self-service, exigir telefone a cada pedido criaria atrito sem
// necessidade — se o cliente quiser se identificar, os campos são opcionais).
const WALK_IN_CUSTOMER_PHONE = "00000000000";
const WALK_IN_CUSTOMER_NAME = "Cliente do salão";

export async function getOrCreateWalkInCustomer() {
  const existing = await getCustomerByPhone(WALK_IN_CUSTOMER_PHONE);
  if (existing) return existing;
  const created = await saveCustomerProfile({ phone: WALK_IN_CUSTOMER_PHONE, name: WALK_IN_CUSTOMER_NAME });
  if (!created) throw new Error("Não foi possível preparar o cliente padrão do salão.");
  return created;
}

export async function listTables() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db.select().from(restaurantTables).where(eq(restaurantTables.active, true)).orderBy(asc(restaurantTables.sector), asc(restaurantTables.sortOrder));
}

export async function getTableById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [table] = await db.select().from(restaurantTables).where(eq(restaurantTables.id, id)).limit(1);
  return table;
}

export async function findTableByToken(token: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [table] = await db.select().from(restaurantTables).where(and(eq(restaurantTables.qrToken, token), eq(restaurantTables.active, true))).limit(1);
  return table;
}

export async function createTable(input: { label: string; sector: string; capacity: number; sortOrder?: number }, conn?: DbOrTx) {
  const db = conn ?? await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const result = await db.insert(restaurantTables).values({
    label: input.label,
    sector: input.sector,
    capacity: input.capacity,
    qrToken: generateQrToken(),
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  return Number(result[0].insertId);
}

export async function updateTable(id: number, input: Partial<{ label: string; sector: string; capacity: number; sortOrder: number; active: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(restaurantTables).set({ ...input, updatedAt: Date.now() }).where(eq(restaurantTables.id, id));
}

export async function regenerateTableQrToken(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const token = generateQrToken();
  await db.update(restaurantTables).set({ qrToken: token, updatedAt: Date.now() }).where(eq(restaurantTables.id, id));
  return token;
}
