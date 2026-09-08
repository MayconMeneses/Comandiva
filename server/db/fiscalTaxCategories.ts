import { and, desc, eq, isNull } from "drizzle-orm";
import { fiscalTaxCategories, products } from "../../drizzle/schema";
import { getDb } from "./client";

export async function listFiscalTaxCategories() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db.select().from(fiscalTaxCategories).orderBy(desc(fiscalTaxCategories.active), fiscalTaxCategories.name);
}

export async function saveFiscalTaxCategory(input: {
  id?: number;
  name: string;
  notes?: string;
  csosn?: string;
  cst?: string;
  icmsRateBasisPoints?: number;
  pisRateBasisPoints?: number;
  cofinsRateBasisPoints?: number;
  cfop?: string;
  active: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const values = {
    name: input.name,
    notes: input.notes || null,
    csosn: input.csosn || null,
    cst: input.cst || null,
    icmsRateBasisPoints: input.icmsRateBasisPoints ?? null,
    pisRateBasisPoints: input.pisRateBasisPoints ?? null,
    cofinsRateBasisPoints: input.cofinsRateBasisPoints ?? null,
    cfop: input.cfop || null,
    active: input.active,
    updatedAt: now,
  };
  if (input.id) {
    await db.update(fiscalTaxCategories).set(values).where(eq(fiscalTaxCategories.id, input.id));
    return { id: input.id };
  }
  const result = await db.insert(fiscalTaxCategories).values({ ...values, createdAt: now });
  return { id: Number(result[0].insertId) };
}

/** Nunca apaga de fato — uma categoria pode já estar vinculada a produtos e (no futuro) a documentos fiscais emitidos; desativar preserva o histórico. */
export async function deactivateFiscalTaxCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(fiscalTaxCategories).set({ active: false, updatedAt: Date.now() }).where(eq(fiscalTaxCategories.id, id));
  return { success: true };
}

export async function assignProductFiscalCategory(productId: number, fiscalCategoryId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(products).set({ fiscalCategoryId, updatedAt: Date.now() }).where(eq(products.id, productId));
  return { success: true };
}

/** Quantos produtos ativos (não arquivados) ainda não têm categoria fiscal — pra mostrar "faltam N produtos" na tela, sem ter que listar tudo. */
export async function countProductsWithoutFiscalCategory() {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ id: products.id }).from(products).where(and(isNull(products.fiscalCategoryId), isNull(products.archivedAt)));
  return rows.length;
}
