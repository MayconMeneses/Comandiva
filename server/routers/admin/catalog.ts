import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { addonGroups, addonOptions, categories, products } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { restaurantProcedureFor, router } from "../../_core/trpc";
import { storagePut } from "../../storage";
import { optionalId, sortOrder } from "./shared";

export const adminCatalogRouter = router({
  setProductAvailability: restaurantProcedureFor("catalog").input(z.object({ productId: z.number().int().positive(), available: z.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.update(products).set({ available: input.available, updatedAt: Date.now() }).where(eq(products.id, input.productId));
    return { success: true };
  }),
  uploadProductImage: restaurantProcedureFor("catalog").input(z.object({ filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]), dataBase64: z.string().min(8).max(29_000_000) })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 20_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 20 MB." });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`catalog/product-images/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    return { url: stored.url, filename: input.filename.slice(0, 160) };
  }),
  catalog: restaurantProcedureFor("catalog").query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [categoryRows, productRows, groupRows, optionRows] = await Promise.all([
      db.select().from(categories).orderBy(categories.sortOrder),
      db.select().from(products).where(isNull(products.archivedAt)).orderBy(products.sortOrder),
      db.select().from(addonGroups).orderBy(addonGroups.sortOrder),
      db.select().from(addonOptions).orderBy(addonOptions.sortOrder),
    ]);
    return { categories: categoryRows, products: productRows, addonGroups: groupRows, addonOptions: optionRows };
  }),
  deleteCategory: restaurantProcedureFor("catalog").input(z.object({ categoryId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [inUse] = await db.select({ id: products.id }).from(products).where(and(eq(products.categoryId, input.categoryId), isNull(products.archivedAt))).limit(1);
    if (inUse) throw new TRPCError({ code: "BAD_REQUEST", message: "Essa categoria ainda tem produtos. Mova ou apague os produtos dela antes de excluir a categoria." });
    await db.delete(categories).where(eq(categories.id, input.categoryId));
    return { success: true };
  }),
  saveCategory: restaurantProcedureFor("catalog").input(z.object({ id: optionalId, name: z.string().min(2).max(100), description: z.string().max(255).optional(), imageUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional(), timeAvailability: z.enum(["ALWAYS", "LUNCH", "DINNER", "LUNCH_AND_DINNER"]).default("ALWAYS"), sortOrder, active: z.boolean().default(true) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    const values = { name: input.name, description: input.description || null, imageUrl: input.imageUrl ? input.imageUrl : null, timeAvailability: input.timeAvailability, sortOrder: input.sortOrder, active: input.active, updatedAt: now };
    if (input.id) {
      await db.update(categories).set(values).where(eq(categories.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(categories).values({ ...values, createdAt: now });
    return { id: Number(result[0].insertId) };
  }),
  saveProduct: restaurantProcedureFor("catalog").input(z.object({ id: optionalId, categoryId: z.number().int().positive(), name: z.string().min(2).max(140), description: z.string().max(2000).optional(), imageUrl: z.string().url().or(z.string().startsWith("/")).optional(), priceCents: z.number().int().min(0).max(9999999), preparationMinutes: z.number().int().min(1).max(240).default(20), available: z.boolean().default(true), featured: z.boolean().default(false), onPromotion: z.boolean().default(false), sortOrder })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    if (input.id) {
      await db.update(products).set({ categoryId: input.categoryId, name: input.name, description: input.description || null, imageUrl: input.imageUrl || null, priceCents: input.priceCents, preparationMinutes: input.preparationMinutes, available: input.available, featured: input.featured, onPromotion: input.onPromotion, sortOrder: input.sortOrder, updatedAt: now }).where(eq(products.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(products).values({ categoryId: input.categoryId, name: input.name, description: input.description || null, imageUrl: input.imageUrl || null, priceCents: input.priceCents, preparationMinutes: input.preparationMinutes, available: input.available, featured: input.featured, onPromotion: input.onPromotion, sortOrder: input.sortOrder, createdAt: now, updatedAt: now });
    return { id: Number(result[0].insertId) };
  }),
  deleteProduct: restaurantProcedureFor("catalog").input(z.object({ productId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), isNull(products.archivedAt))).limit(1);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado ou já excluído." });
    const now = Date.now();
    await db.update(products).set({ available: false, archivedAt: now, updatedAt: now }).where(eq(products.id, input.productId));
    return { success: true };
  }),
  deleteAddonGroup: restaurantProcedureFor("catalog").input(z.object({ groupId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(addonOptions).where(eq(addonOptions.groupId, input.groupId));
    await db.delete(addonGroups).where(eq(addonGroups.id, input.groupId));
    return { success: true };
  }),
  deleteAddonOption: restaurantProcedureFor("catalog").input(z.object({ optionId: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(addonOptions).where(eq(addonOptions.id, input.optionId));
    return { success: true };
  }),
  saveAddonGroup: restaurantProcedureFor("catalog").input(z.object({ id: optionalId, productId: z.number().int().positive(), name: z.string().min(2).max(120), required: z.boolean().default(false), minSelections: z.number().int().min(0).max(10).default(0), maxSelections: z.number().int().min(1).max(10).default(1), sortOrder, active: z.boolean().default(true) }).superRefine((value, context) => {
    if (value.minSelections > value.maxSelections) context.addIssue({ code: "custom", path: ["minSelections"], message: "O mínimo não pode ser maior que o máximo." });
  })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    if (input.id) {
      await db.update(addonGroups).set({ productId: input.productId, name: input.name, required: input.required, minSelections: input.minSelections, maxSelections: input.maxSelections, sortOrder: input.sortOrder, active: input.active, updatedAt: now }).where(eq(addonGroups.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(addonGroups).values({ productId: input.productId, name: input.name, required: input.required, minSelections: input.minSelections, maxSelections: input.maxSelections, sortOrder: input.sortOrder, active: input.active, createdAt: now, updatedAt: now });
    return { id: Number(result[0].insertId) };
  }),
  saveAddonOption: restaurantProcedureFor("catalog").input(z.object({ id: optionalId, groupId: z.number().int().positive(), name: z.string().min(2).max(120), priceCents: z.number().int().min(0).max(9999999), available: z.boolean().default(true), sortOrder })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    if (input.id) {
      await db.update(addonOptions).set({ groupId: input.groupId, name: input.name, priceCents: input.priceCents, available: input.available, sortOrder: input.sortOrder, updatedAt: now }).where(eq(addonOptions.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(addonOptions).values({ groupId: input.groupId, name: input.name, priceCents: input.priceCents, available: input.available, sortOrder: input.sortOrder, createdAt: now, updatedAt: now });
    return { id: Number(result[0].insertId) };
  }),
  // Sem "image/svg+xml" de propósito: SVG é servido pelo bucket público sem
  // Content-Disposition, então abrir a URL direto (aba nova, link
  // compartilhado) executa qualquer <script>/onload embutido como documento
  // — o navegador só desativa isso quando o SVG é carregado via <img>, não
  // quando é acessado como URL própria. Ver auditoria de segurança.
  uploadCategoryImage: restaurantProcedureFor("catalog").input(z.object({ filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(8).max(70_000_000) })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 45_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 45 MB." });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`branding/categories/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    return { url: stored.url };
  }),
});
