import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { masterPanelSettings } from "../../drizzle/schema";

/**
 * Linha única (singleton) — criada sob demanda na primeira leitura, sem seed
 * (saas-core é um deployment só, sem bootstrap por restaurante). Sem cache:
 * tela de baixíssimo tráfego, só admins da plataforma acessam.
 */
export async function getMasterPanelSettings() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select().from(masterPanelSettings).limit(1);
  if (existing) return existing;
  const now = Date.now();
  await db.insert(masterPanelSettings).values({ backgroundColor: null, updatedAt: now });
  const [created] = await db.select().from(masterPanelSettings).limit(1);
  return created!;
}

export async function setMasterPanelBackgroundColor(backgroundColor: string | null) {
  const current = await getMasterPanelSettings();
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(masterPanelSettings).set({ backgroundColor, updatedAt: Date.now() }).where(eq(masterPanelSettings.id, current.id));
  return { success: true as const };
}
