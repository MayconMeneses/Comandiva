import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { faqItems } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { adminProcedure, router } from "../../_core/trpc";
import { optionalId, sortOrder } from "./shared";

export const adminFaqRouter = router({
  faqItems: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    return db.select().from(faqItems).orderBy(asc(faqItems.sortOrder));
  }),
  saveFaqItem: adminProcedure.input(z.object({ id: optionalId, question: z.string().min(3).max(300), answer: z.string().min(1).max(3000), active: z.boolean().default(true), sortOrder })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    const values = { question: input.question, answer: input.answer, active: input.active, sortOrder: input.sortOrder, updatedAt: now };
    if (input.id) {
      await db.update(faqItems).set(values).where(eq(faqItems.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(faqItems).values({ ...values, createdAt: now });
    return { id: Number(result[0].insertId) };
  }),
  deleteFaqItem: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(faqItems).where(eq(faqItems.id, input.id));
    return { success: true };
  }),
});
