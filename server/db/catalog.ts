import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { addonGroups, addonOptions, categories, events, faqItems, products, promotionAddonDefaults, promotionProducts, promotions } from "../../drizzle/schema";
import { isCategoryCurrentlyAvailable } from "../../shared/orderDomain";
import { cached, CATALOG_CACHE_TTL_MS, getDb } from "./client";
import { getStoreSettings } from "./settings";

async function fetchCatalog() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [categoryRows, productRows, groupRows, optionRows, settings] = await Promise.all([
    db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sortOrder)),
    // Cardápio público: só produto disponível E não arquivado. Indisponível
    // some da vitrine em vez de aparecer desabilitado — o admin continua
    // vendo tudo (consulta própria, sempre fresca) pra poder reativar.
    db.select().from(products).where(and(isNull(products.archivedAt), eq(products.available, true))).orderBy(asc(products.sortOrder)),
    db.select().from(addonGroups).where(eq(addonGroups.active, true)).orderBy(asc(addonGroups.sortOrder)),
    db.select().from(addonOptions).orderBy(asc(addonOptions.sortOrder)),
    getStoreSettings(),
  ]);
  return categoryRows
    .filter(category => isCategoryCurrentlyAvailable(category, settings))
    .map(category => ({
      ...category,
      products: productRows
        .filter(product => product.categoryId === category.id)
        .map(product => ({
          ...product,
          addonGroups: groupRows
            .filter(group => group.productId === product.id)
            .map(group => ({
              ...group,
              options: optionRows.filter(option => option.groupId === group.id),
            })),
        })),
    })).filter(category => category.products.length > 0);
}
// Cardápio público: consultado a cada carregamento da página inicial por todo
// visitante. Cache curto evita que um pico de acessos simultâneos vire um
// pico equivalente de consultas ao banco — o preço é até CATALOG_CACHE_TTL_MS
// de atraso para uma mudança no cardápio aparecer no site (aceitável; o
// painel administrativo sempre lê dados frescos, pois usa suas próprias
// consultas diretas).
export const getCatalog = cached(CATALOG_CACHE_TTL_MS, fetchCatalog);

/**
 * Anexa a cada promoção os produtos reais do cardápio vinculados a ela
 * (promotion_products), com nome/imagem/preço — usado tanto pela consulta
 * pública (cacheada) quanto pela do admin (sempre fresca), pra não duplicar
 * essa junção em dois lugares.
 */
export async function attachPromotionProducts<T extends { id: number }>(promotionRows: T[]) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  if (!promotionRows.length) return promotionRows.map(promotion => ({ ...promotion, products: [] }));
  const promotionIds = promotionRows.map(promotion => promotion.id);
  const links = await db.select().from(promotionProducts).where(inArray(promotionProducts.promotionId, promotionIds)).orderBy(asc(promotionProducts.sortOrder));
  const productIds = Array.from(new Set(links.map(link => link.productId)));
  const [productRows, groupRows, defaultRows] = await Promise.all([
    productIds.length ? db.select().from(products).where(inArray(products.id, productIds)) : Promise.resolve([]),
    productIds.length ? db.select().from(addonGroups).where(inArray(addonGroups.productId, productIds)) : Promise.resolve([]),
    db.select().from(promotionAddonDefaults).where(inArray(promotionAddonDefaults.promotionId, promotionIds)),
  ]);
  const groupIds = groupRows.map(group => group.id);
  const optionRows = groupIds.length ? await db.select().from(addonOptions).where(inArray(addonOptions.groupId, groupIds)) : [];
  // Adicionais obrigatórios de um produto do combo precisam de uma resolução
  // por promoção (ver promotionAddonDefaults) — sem isso, adicionar o combo
  // inteiro com um clique deixaria o item sem o adicional exigido, e o
  // checkout rejeitaria no servidor sem o cliente entender o motivo.
  const attachAddonGroups = (productId: number, promotionId: number) =>
    groupRows
      .filter(group => group.productId === productId && group.active)
      .map(group => {
        const config = defaultRows.find(row => row.promotionId === promotionId && row.productId === productId && row.addonGroupId === group.id);
        return { ...group, options: optionRows.filter(option => option.groupId === group.id), promotionDefault: config ? { mode: config.mode, defaultOptionId: config.defaultOptionId } : null };
      });
  return promotionRows.map(promotion => ({
    ...promotion,
    products: links
      .filter(link => link.promotionId === promotion.id)
      .map(link => {
        const product = productRows.find(candidate => candidate.id === link.productId);
        return product ? { ...product, addonGroups: attachAddonGroups(product.id, promotion.id) } : undefined;
      })
      .filter((product): product is NonNullable<typeof product> => Boolean(product)),
  }));
}

async function fetchActivePromotions() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const rows = await db.select().from(promotions).where(eq(promotions.active, true)).orderBy(asc(promotions.sortOrder));
  const withProducts = await attachPromotionProducts(rows);
  // Promoções antigas de antes do vínculo com produto real (ex.: cadastradas
  // via priceLabel/imageUrl manuais) não têm produto associado e não devem
  // aparecer pro cliente — ficariam com preço R$ 0,00 e um botão que não faz
  // nada. Continuam visíveis no admin pra quem quiser corrigi-las.
  return withProducts.filter(promotion => promotion.products.length > 0);
}
export const getActivePromotions = cached(CATALOG_CACHE_TTL_MS, fetchActivePromotions);

async function fetchActiveEvents() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db.select().from(events).where(eq(events.active, true)).orderBy(asc(events.sortOrder));
}
export const getActiveEvents = cached(CATALOG_CACHE_TTL_MS, fetchActiveEvents);

async function fetchActiveFaqItems() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db.select().from(faqItems).where(eq(faqItems.active, true)).orderBy(asc(faqItems.sortOrder));
}
export const getActiveFaqItems = cached(CATALOG_CACHE_TTL_MS, fetchActiveFaqItems);

export async function getProductDetail(productId: number) {
  const catalog = await getCatalog();
  return catalog.flatMap(category => category.products).find(product => product.id === productId);
}
