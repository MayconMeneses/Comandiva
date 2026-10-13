import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { events } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { requireFeature, restaurantProcedureFor, router } from "../../_core/trpc";
import { assertRealImageMatchesDeclaredType, storagePut } from "../../storage";
import { optionalId, sortOrder } from "./shared";

// Recurso de plano (ver pedido do dono, 2026-09-10) — mesmo padrão de
// admin/promotions.ts: o gate de plano soma por cima do de permissão de
// staff ("events" aqui é coincidência de nome, são dois eixos diferentes —
// ver shared/permissions.ts vs server/_core/license.ts::FEATURE_IDS).
const eventsProcedure = restaurantProcedureFor("events").use(requireFeature("events"));

export const adminEventsRouter = router({
  events: eventsProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    return db.select().from(events).orderBy(asc(events.sortOrder));
  }),
  saveEvent: eventsProcedure.input(z.object({ id: optionalId, title: z.string().min(2).max(140), description: z.string().max(1000).optional(), imageUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional(), eventDate: z.string().max(60).optional(), active: z.boolean().default(true), sortOrder })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    const values = { title: input.title, description: input.description || null, imageUrl: input.imageUrl ? input.imageUrl : null, eventDate: input.eventDate || null, active: input.active, sortOrder: input.sortOrder, updatedAt: now };
    if (input.id) {
      await db.update(events).set(values).where(eq(events.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(events).values({ ...values, createdAt: now });
    return { id: Number(result[0].insertId) };
  }),
  deleteEvent: eventsProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(events).where(eq(events.id, input.id));
    return { success: true };
  }),
  uploadEventImage: eventsProcedure.input(z.object({ filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(8).max(140_000_000) })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 100_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 100 MB." });
    await assertRealImageMatchesDeclaredType(bytes, input.contentType);
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`branding/events/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    return { url: stored.url };
  }),
});
