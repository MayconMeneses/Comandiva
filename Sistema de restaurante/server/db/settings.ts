import { restaurantSettings } from "../../drizzle/schema";
import { cached, CATALOG_CACHE_TTL_MS, getDb } from "./client";

export async function getStoreSettings() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [settings] = await db.select().from(restaurantSettings).limit(1);
  return settings;
}

// Lida no caminho público (cardápio/checkout) a cada carregamento — mesma
// política de cache já usada pelo cardápio em catalog.ts (`getCatalog`). O
// admin continua chamando `getStoreSettings()` direto (sem cache) na tela
// que edita essas configurações, pra ver o próprio salvamento na hora.
export const getStoreSettingsCached = cached(CATALOG_CACHE_TTL_MS, getStoreSettings);
