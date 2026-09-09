import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCustomerByPhone, saveCustomerProfile } from "../db";
import { normalizePhone } from "../../shared/orderDomain";
import { checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";

const phoneSchema = z.string().min(10).max(24).transform(normalizePhone).refine(value => value.length === 10 || value.length === 11, "Informe um telefone válido.");
const addressSchema = z.object({
  postalCode: z.string().max(12).optional(),
  street: z.string().min(2).max(180),
  number: z.string().min(1).max(30),
  complement: z.string().max(120).optional(),
  neighborhood: z.string().min(2).max(120),
  city: z.string().min(2).max(120),
  state: z.string().length(2).transform(value => value.toUpperCase()),
  reference: z.string().max(255).optional(),
});

export const customerRouter = router({
  // Consulta pública: qualquer pessoa pode chamar isso com um telefone
  // arbitrário e receber nome completo + endereço do cliente, se existir. O
  // rate limit por IP existe para impedir que alguém varra números de
  // telefone em sequência colhendo dados pessoais (nome e endereço) de
  // clientes reais — não é proteção de login, é proteção contra enumeração.
  lookupByPhone: publicProcedure.input(z.object({ phone: phoneSchema })).query(async ({ input, ctx }) => {
    const limit = checkRateLimit(`customer-lookup:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas consultas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    return getCustomerByPhone(input.phone);
  }),
  // Sobrescreve nome/endereço padrão de um cliente já cadastrado só pelo
  // telefone (sem sessão) — mesmo raciocínio de rate limit do lookupByPhone
  // acima: sem isso, dava pra martelar esse endpoint sem limite.
  saveProfile: publicProcedure.input(z.object({
    phone: phoneSchema,
    name: z.string().min(2).max(160),
    address: addressSchema.optional(),
  })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`customer-save-profile:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    return saveCustomerProfile(input);
  }),
});

export { addressSchema, phoneSchema };
