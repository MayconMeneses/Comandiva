import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getCustomerByPhone } from "../db";
import { normalizePhone } from "../../shared/orderDomain";
import { checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";

const phoneSchema = z.string().min(10).max(24).transform(normalizePhone).refine(value => value.length === 10 || value.length === 11, "Informe um telefone válido.");
// Defesa em profundidade contra XSS armazenado (auditoria V-39): nome e
// observação de cliente/pedido/mesa nunca deveriam aceitar "<"/">" — hoje
// nenhum sink de HTML cru existe no código (SPA React escapa tudo), mas
// essa barreira não pode depender só disso continuar verdade pra sempre.
const noHtmlChars = /^[^<>]*$/;
function safeText<T extends z.ZodString>(schema: T) {
  return schema.regex(noHtmlChars, "Não use os caracteres < ou >.");
}
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
    // Continua mais apertado que os outros endpoints (o propósito aqui é
    // anti-enumeração, não só anti-abuso — ver comentário acima), só um
    // pouco mais alto que o padrão de força bruta pra não barrar clientes
    // legítimos atrás do mesmo IP em horário de pico.
    const limit = checkRateLimit(`customer-lookup:${ctx.req.ip}`, { maxAttempts: 20 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas consultas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    return getCustomerByPhone(input.phone);
  }),
});

export { addressSchema, phoneSchema, safeText };
