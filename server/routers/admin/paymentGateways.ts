import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { paymentGateways } from "../../../drizzle/schema";
import { getDb, recordAccountAudit } from "../../db";
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
  // Log de auditoria nunca inclui apiKey/secretKey — só o fato de que
  // mudaram (`apiKeyChanged`/`secretKeyChanged`), nunca o valor (achado M1:
  // antes, trocar a credencial de um gateway não deixava rastro nenhum, e é
  // justamente o tipo de campo que não pode virar um vazamento novo dentro
  // do próprio log de auditoria).
  savePaymentGateway: adminOnlyProcedure.input(z.object({ id: optionalId, provider: z.enum(["MERCADO_PAGO", "PAGSEGURO", "STRIPE", "CIELO", "REDE", "GETNET", "PAYPAL", "OUTRO"]), label: z.string().min(2).max(120), apiKey: z.string().max(500).optional(), secretKey: z.string().max(500).optional(), extra: z.string().max(1000).optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    if (input.id) {
      const values: Record<string, unknown> = { provider: input.provider, label: input.label, extra: input.extra || null, updatedAt: now };
      if (input.apiKey) values.apiKey = input.apiKey; // só sobrescreve se uma nova foi digitada
      if (input.secretKey) values.secretKey = input.secretKey; // só sobrescreve se uma nova foi digitada
      await db.update(paymentGateways).set(values).where(eq(paymentGateways.id, input.id));
      await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "paymentGateway.updated", entityType: "paymentGateway", entityId: input.id, after: { provider: input.provider, label: input.label, apiKeyChanged: Boolean(input.apiKey), secretKeyChanged: Boolean(input.secretKey) }, ip: ctx.req.ip });
      return { id: input.id };
    }
    const result = await db.insert(paymentGateways).values({ provider: input.provider, label: input.label, apiKey: input.apiKey || null, secretKey: input.secretKey || null, extra: input.extra || null, active: false, createdAt: now, updatedAt: now });
    const newId = Number(result[0].insertId);
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "paymentGateway.created", entityType: "paymentGateway", entityId: newId, after: { provider: input.provider, label: input.label, apiKeyChanged: Boolean(input.apiKey), secretKeyChanged: Boolean(input.secretKey) }, ip: ctx.req.ip });
    return { id: newId };
  }),
  setActivePaymentGateway: adminOnlyProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    if (input.active) await db.update(paymentGateways).set({ active: false, updatedAt: Date.now() }); // só um pode ficar ativo por vez
    await db.update(paymentGateways).set({ active: input.active, updatedAt: Date.now() }).where(eq(paymentGateways.id, input.id));
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "paymentGateway.activeChanged", entityType: "paymentGateway", entityId: input.id, after: { active: input.active }, ip: ctx.req.ip });
    return { success: true };
  }),
  deletePaymentGateway: adminOnlyProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.delete(paymentGateways).where(eq(paymentGateways.id, input.id));
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "paymentGateway.deleted", entityType: "paymentGateway", entityId: input.id, ip: ctx.req.ip });
    return { success: true };
  }),
});
