import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { addonGroups, addonOptions, products, promotionAddonDefaults, promotionProducts, promotions } from "../../../drizzle/schema";
import { attachPromotionProducts, getDb } from "../../db";
import { requireFeature, restaurantProcedureFor, router } from "../../_core/trpc";
import { optionalId, sortOrder } from "./shared";

// Gerenciar promoções agora é um recurso de plano (ver auditoria/pedido do
// dono, 2026-09-10) — mesmo padrão de server/routers/admin/tables.ts: o
// gate de plano some por cima do de permissão de staff, os dois precisam
// passar. O que os CLIENTES veem publicamente (catalog.promotions) não é
// afetado por este gate — só a capacidade do admin de criar/editar.
const promotionsProcedure = restaurantProcedureFor("promotions").use(requireFeature("promotions"));

const promotionObjectiveSchema = z.enum([
  "INCREASE_SALES",
  "INCREASE_AVERAGE_TICKET",
  "ATTRACT_NEW_CUSTOMERS",
  "BOOST_LOW_DAY",
  "BOOST_LOW_HOUR",
  "BOOST_DELIVERY",
  "REDUCE_STOCK",
  "PROMOTE_PRODUCT",
  "LOYALTY",
]);

export const adminPromotionsRouter = router({
  promotions: promotionsProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const rows = await db.select().from(promotions).orderBy(promotions.sortOrder);
    return attachPromotionProducts(rows);
  }),
  savePromotion: promotionsProcedure.input(z.object({
    id: optionalId,
    title: z.string().min(2).max(140),
    description: z.string().max(500).optional(),
    promoPriceCents: z.number().int().min(0).max(9999999).optional(),
    objective: promotionObjectiveSchema.optional(),
    validDays: z.string().max(160).optional(),
    productIds: z.array(z.number().int().positive()).min(1, "Escolha ao menos um produto do cardápio."),
    // Resolução de adicionais obrigatórios ao adicionar o combo com um clique
    // — só precisa vir preenchido para grupos onde o admin optou por um valor
    // fixo (ADMIN_DEFAULT); grupos omitidos ficam CUSTOMER_CHOICE por padrão.
    addonDefaults: z.array(z.object({
      productId: z.number().int().positive(),
      addonGroupId: z.number().int().positive(),
      mode: z.enum(["ADMIN_DEFAULT", "CUSTOMER_CHOICE"]),
      defaultOptionId: z.number().int().positive().optional(),
    })).default([]),
    active: z.boolean().default(true),
    sortOrder,
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const productRows = await db.select({ id: products.id, priceCents: products.priceCents }).from(products).where(inArray(products.id, input.productIds));
    if (productRows.length !== new Set(input.productIds).size) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Um dos produtos selecionados não foi encontrado." });
    }
    if (input.addonDefaults.some(entry => entry.mode === "ADMIN_DEFAULT" && !entry.defaultOptionId)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha uma opção para cada adicional definido pelo admin." });
    }
    if (input.addonDefaults.length) {
      const groupIds = Array.from(new Set(input.addonDefaults.map(entry => entry.addonGroupId)));
      const optionIds = input.addonDefaults.filter(entry => entry.defaultOptionId).map(entry => entry.defaultOptionId!);
      const [groupRows, optionRows] = await Promise.all([
        db.select().from(addonGroups).where(inArray(addonGroups.id, groupIds)),
        optionIds.length ? db.select().from(addonOptions).where(inArray(addonOptions.id, optionIds)) : Promise.resolve([]),
      ]);
      for (const entry of input.addonDefaults) {
        const group = groupRows.find(candidate => candidate.id === entry.addonGroupId);
        if (!group || group.productId !== entry.productId) throw new TRPCError({ code: "BAD_REQUEST", message: "Um adicional configurado não pertence ao produto informado." });
        if (entry.defaultOptionId && !optionRows.some(option => option.id === entry.defaultOptionId && option.groupId === entry.addonGroupId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A opção padrão escolhida não pertence a esse adicional." });
        }
      }
    }
    // Regra comercial: o preço promocional precisa ser realmente menor que a
    // soma dos produtos reais vinculados — senão não é promoção, é preço maior.
    if (input.promoPriceCents !== undefined) {
      const normalTotal = productRows.reduce((sum, product) => sum + product.priceCents, 0);
      if (input.promoPriceCents >= normalTotal) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O preço promocional precisa ser menor que a soma do preço normal dos produtos escolhidos." });
      }
    }
    const now = Date.now();
    const values = { title: input.title, description: input.description || null, promoPriceCents: input.promoPriceCents ?? null, objective: input.objective ?? null, validDays: input.validDays || null, active: input.active, sortOrder: input.sortOrder, updatedAt: now };
    let promotionId: number;
    if (input.id) {
      await db.update(promotions).set(values).where(eq(promotions.id, input.id));
      promotionId = input.id;
    } else {
      const result = await db.insert(promotions).values({ ...values, createdAt: now });
      promotionId = Number(result[0].insertId);
    }
    await db.delete(promotionProducts).where(eq(promotionProducts.promotionId, promotionId));
    await db.insert(promotionProducts).values(input.productIds.map((productId, index) => ({ promotionId, productId, sortOrder: index, createdAt: now })));
    await db.delete(promotionAddonDefaults).where(eq(promotionAddonDefaults.promotionId, promotionId));
    if (input.addonDefaults.length) {
      await db.insert(promotionAddonDefaults).values(input.addonDefaults.map(entry => ({ promotionId, productId: entry.productId, addonGroupId: entry.addonGroupId, mode: entry.mode, defaultOptionId: entry.defaultOptionId ?? null, createdAt: now })));
    }
    return { id: promotionId };
  }),
  deletePromotion: promotionsProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(promotionProducts).where(eq(promotionProducts.promotionId, input.id));
    await db.delete(promotionAddonDefaults).where(eq(promotionAddonDefaults.promotionId, input.id));
    await db.delete(promotions).where(eq(promotions.id, input.id));
    return { success: true };
  }),
});
