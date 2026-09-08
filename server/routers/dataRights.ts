import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { customers } from "../../drizzle/schema";
import { anonymizeCustomer, createPhoneVerificationCode, getCustomerByPhone, getDb, getOrdersSummaryByPhone, verifyPhoneVerificationCode } from "../db";
import { createDataRightsToken, verifyDataRightsToken } from "../_core/dataRightsToken";
import { checkDistinctRateLimit, checkRateLimit } from "../_core/rateLimit";
import { sendSms } from "../_core/sms";
import { publicProcedure, router } from "../_core/trpc";
import { phoneSchema } from "./customer";

const GENERIC_CODE_ERROR = "Código inválido ou expirado. Peça um novo código.";

export const dataRightsRouter = router({
  // Autoatendimento LGPD (ver client/src/pages/DataRights.tsx) — funciona pra
  // qualquer telefone, exista ou não como cliente (nunca revela isso aqui,
  // mesmo raciocínio anti-enumeração de customer.ts::lookupByPhone). Duplo
  // rate limit: por IP+telefone (repetir o mesmo número não é enumeração) e
  // por IP contra vários números diferentes (isso sim é).
  requestCode: publicProcedure.input(z.object({ phone: phoneSchema })).mutation(async ({ input, ctx }) => {
    const perPhoneLimit = checkRateLimit(`data-rights-request:${ctx.req.ip}:${input.phone}`);
    if (!perPhoneLimit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitos pedidos de código. Tente novamente em ${Math.ceil((perPhoneLimit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const distinctLimit = checkDistinctRateLimit(`data-rights-request-ip:${ctx.req.ip}`, input.phone, 5);
    if (!distinctLimit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitos números diferentes tentados. Tente novamente mais tarde." });

    const code = await createPhoneVerificationCode(input.phone);
    // phoneSchema normaliza sem o código do país (normalizePhone) — Twilio
    // exige E.164 completo, mesmo raciocínio de toWhatsAppDigits em
    // client/src/components/WhatsAppButton.tsx.
    const result = await sendSms(`+55${input.phone}`, `Pub X: seu código de verificação é ${code}. Válido por 10 minutos.`);
    return { sent: result.sent };
  }),

  verifyCode: publicProcedure.input(z.object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/, "Código deve ter 6 dígitos.") })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`data-rights-verify:${ctx.req.ip}:${input.phone}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });

    const result = await verifyPhoneVerificationCode(input.phone, input.code);
    if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: GENERIC_CODE_ERROR });

    const db = await getDb();
    if (db) {
      const existing = await getCustomerByPhone(input.phone);
      if (existing) await db.update(customers).set({ phoneVerifiedAt: Date.now() }).where(eq(customers.id, existing.id));
    }
    return { token: await createDataRightsToken(input.phone) };
  }),

  myData: publicProcedure.input(z.object({ phone: phoneSchema, token: z.string().min(10) })).query(async ({ input }) => {
    if (!(await verifyDataRightsToken(input.token, input.phone))) throw new TRPCError({ code: "FORBIDDEN", message: "Sessão de verificação expirada. Peça um novo código." });
    const [customer, orders] = await Promise.all([getCustomerByPhone(input.phone), getOrdersSummaryByPhone(input.phone)]);
    return { customer: customer ?? null, orders };
  }),

  deleteMyData: publicProcedure.input(z.object({ phone: phoneSchema, token: z.string().min(10) })).mutation(async ({ input }) => {
    if (!(await verifyDataRightsToken(input.token, input.phone))) throw new TRPCError({ code: "FORBIDDEN", message: "Sessão de verificação expirada. Peça um novo código." });
    const customer = await getCustomerByPhone(input.phone);
    if (customer) await anonymizeCustomer(customer.id);
    return { success: true };
  }),
});
