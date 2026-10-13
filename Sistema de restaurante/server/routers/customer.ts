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

// Primeiro nome só — o suficiente pra tela de checkout perguntar "é você?" sem
// entregar o nome completo de quem quer que digite um telefone.
function firstNameOf(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export const customerRouter = router({
  // Consulta pública (sem login): qualquer pessoa pode chamar com um telefone
  // arbitrário. Por isso devolve o MÍNIMO — só se existe cadastro e o primeiro
  // nome (auditoria de segurança 2026-10-10). Antes devolvia nome completo +
  // todos os endereços, o que permitia varrer telefones colhendo dados
  // residenciais. A equipe logada (balcão) preenche endereço pelo procedure
  // autenticado admin.lookupCustomerByPhone. O rate limit por IP continua: o
  // propósito é anti-enumeração de quais telefones têm cadastro.
  lookupByPhone: publicProcedure.input(z.object({ phone: phoneSchema })).query(async ({ input, ctx }) => {
    // Continua mais apertado que os outros endpoints, só um pouco mais alto que
    // o padrão de força bruta pra não barrar clientes legítimos atrás do mesmo
    // IP em horário de pico.
    const limit = checkRateLimit(`customer-lookup:${ctx.req.ip}`, { maxAttempts: 20 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas consultas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const customer = await getCustomerByPhone(input.phone);
    return customer ? { firstName: firstNameOf(customer.name) } : undefined;
  }),
});

export { addressSchema, phoneSchema, safeText };
