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

const DEFAULT_CATEGORY_NAME = "Padrão";
// NCM genérico pra "outras preparações alimentícias não especificadas" —
// catch-all comum em sistemas de restaurante pra comida preparada quando
// ninguém cadastrou um NCM mais específico pro produto. Preenchido só se o
// produto ainda não tiver nenhum (nunca sobrescreve um valor já informado).
const DEFAULT_NCM = "21069090";

/**
 * Valores mais comuns por regime tributário pra restaurante — não é
 * cálculo/consultoria fiscal, só um ponto de partida razoável pra quem não
 * tem por que entender CSOSN/CST/CFOP de cara (ver Etapa 1.5 do plano de
 * emissão de NFC-e). A tela de categorias fiscais continua disponível pra
 * ajustar caso a caso (ex.: bebida alcoólica com tributação diferente).
 */
function defaultCategoryValuesFor(regimeTributario: string) {
  const base = { name: DEFAULT_CATEGORY_NAME, notes: "Criada automaticamente — confirme com seu contador.", cfop: "5102", active: true };
  if (regimeTributario === "SIMPLES_NACIONAL" || regimeTributario === "MEI") {
    return { ...base, csosn: "102" }; // tributada pelo Simples Nacional sem permissão de crédito — coberto pelo DAS
  }
  return { ...base, cst: "00" }; // tributada integralmente — ponto de partida pra Lucro Presumido/Real
}

/** NCM padrão pra produto novo (mesmo catch-all usado em `ensureDefaultFiscalTaxCategory`) — só faz sentido usar depois que o cadastro fiscal já rodou pelo menos uma vez (mesma condição de `getDefaultFiscalTaxCategoryId`). */
export function getDefaultNcm() {
  return DEFAULT_NCM;
}

/** Id da categoria "Padrão" se já existir (ver `ensureDefaultFiscalTaxCategory`) — usado ao criar um produto novo, pra ele já nascer categorizado sem o dono precisar lembrar. `null` se o cadastro fiscal ainda nem começou. */
export async function getDefaultFiscalTaxCategoryId() {
  const db = await getDb();
  if (!db) return null;
  const [existing] = await db.select({ id: fiscalTaxCategories.id }).from(fiscalTaxCategories).where(eq(fiscalTaxCategories.name, DEFAULT_CATEGORY_NAME)).limit(1);
  return existing?.id ?? null;
}

/**
 * Garante que existe 1 categoria fiscal "Padrão" pro regime escolhido e
 * associa a todo produto ativo ainda sem categoria. Chamada ao salvar os
 * dados cadastrais fiscais pela primeira vez (server/db/fiscal.ts) — nunca
 * sobrescreve uma categoria "Padrão" já existente nem uma categoria que o
 * dono já tenha escolhido manualmente pra um produto.
 */
export async function ensureDefaultFiscalTaxCategory(regimeTributario: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select().from(fiscalTaxCategories).where(eq(fiscalTaxCategories.name, DEFAULT_CATEGORY_NAME)).limit(1);
  const categoryId = existing ? existing.id : (await saveFiscalTaxCategory(defaultCategoryValuesFor(regimeTributario))).id;
  const now = Date.now();
  await db.update(products).set({ fiscalCategoryId: categoryId, updatedAt: now }).where(and(isNull(products.fiscalCategoryId), isNull(products.archivedAt)));
  await db.update(products).set({ ncm: DEFAULT_NCM, updatedAt: now }).where(and(isNull(products.ncm), isNull(products.archivedAt)));
  return { categoryId };
}
