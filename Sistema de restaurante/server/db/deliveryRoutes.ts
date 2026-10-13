import { asc, eq } from "drizzle-orm";
import { deliveryRoutes } from "../../drizzle/schema";
import { cached, CATALOG_CACHE_TTL_MS, getDb } from "./client";

async function fetchDeliveryRoutes(activeOnly: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const query = db.select().from(deliveryRoutes);
  return activeOnly
    ? query.where(eq(deliveryRoutes.active, true)).orderBy(asc(deliveryRoutes.sortOrder))
    : query.orderBy(asc(deliveryRoutes.sortOrder));
}
const getActiveDeliveryRoutesCached = cached(CATALOG_CACHE_TTL_MS, () => fetchDeliveryRoutes(true));

export async function getDeliveryRoutes(activeOnly = false) {
  // Só o lado público (usado no checkout) é cacheado — o admin sempre vê dados
  // frescos ao gerenciar rotas de entrega.
  return activeOnly ? getActiveDeliveryRoutesCached() : fetchDeliveryRoutes(false);
}

export async function saveDeliveryRoute(input: { id?: number; name: string; coverageNotes?: string; deliveryFeeCents: number; estimatedDeliveryMin: number; estimatedDeliveryMax: number; active: boolean; sortOrder: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const values = { name: input.name.trim(), coverageNotes: input.coverageNotes?.trim() || null, deliveryFeeCents: input.deliveryFeeCents, estimatedDeliveryMin: input.estimatedDeliveryMin, estimatedDeliveryMax: input.estimatedDeliveryMax, active: input.active, sortOrder: input.sortOrder, updatedAt: now };
  if (input.id) {
    await db.update(deliveryRoutes).set(values).where(eq(deliveryRoutes.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(deliveryRoutes).values({ ...values, createdAt: now });
  return { id: Number(result[0].insertId) };
}

export async function deleteDeliveryRoute(routeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.delete(deliveryRoutes).where(eq(deliveryRoutes.id, routeId));
  return { success: true };
}
