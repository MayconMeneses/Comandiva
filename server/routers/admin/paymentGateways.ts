import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { paymentGateways } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { adminOnlyProcedure, router } from "../../_core/trpc";
import { optionalId } from "./shared";

export const adminPaymentGatewaysRouter = router({
  paymentGateways: adminOnlyProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const rows = await db.select().from(paymentGateways).orderBy(desc(paymentGateways.active), desc(paymentGateways.id));
    // Nunca devolve chaves sensíveis para o navegador — só indica se já foram preenchidas.
    return rows.map(row => ({ ...row, apiKey: undefined, secretKey: undefined, hasApiKey: Boolean(row.apiKey), hasSecretKey: Boolean(row.secretKey) }));
  }),
  savePaymentGateway: adminOnlyProcedure.input(z.object({ id: optionalId, provider: z.enum(["MERCADO_PAGO", "PAGSEGURO", "STRIPE", "CIELO", "REDE", "GETNET", "PAYPAL", "OUTRO"]), label: z.string().min(2).max(120), apiKey: z.string().max(500).optional(), secretKey: z.string().max(500).optional(), extra: z.string().max(1000).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    if (input.id) {
      const values: Record<string, unknown> = { provider: input.provider, label: input.label, extra: input.extra || null, updatedAt: now };
      if (input.apiKey) values.apiKey = input.apiKey; // só sobrescreve se uma nova foi digitada
      if (input.secretKey) values.secretKey = input.secretKey; // só sobrescreve se uma nova foi digitada
      await db.update(paymentGateways).set(values).where(eq(paymentGateways.id, input.id));
      return { id: input.id };
    }
    const result = await db.insert(paymentGateways).values({ provider: input.provider, label: input.label, apiKey: input.apiKey || null, secretKey: input.secretKey || null, extra: input.extra || null, active: false, createdAt: now, updatedAt: now });
    return { id: Number(result[0].insertId) };
  }),
  setActivePaymentGateway: adminOnlyProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    if (input.active) await db.update(paymentGateways).set({ active: false, updatedAt: Date.now() }); // só um pode ficar ativo por vez
    await db.update(paymentGateways).set({ active: input.active, updatedAt: Date.now() }).where(eq(paymentGateways.id, input.id));
    return { success: true };
  }),
  deletePaymentGateway: adminOnlyProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(paymentGateways).where(eq(paymentGateways.id, input.id));
    return { success: true };
  }),
});
