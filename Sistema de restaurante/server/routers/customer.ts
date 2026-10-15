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
  // Consulta pública (sem login): cliente que já pediu não redigita nome e
  // endereço no checkout (decisão e autorização do dono, 2026-10-15; em
  // 2026-10-10 a auditoria tinha reduzido isto ao primeiro nome). Devolve só o
  // necessário pra preencher o formulário: nome e o ÚLTIMO endereço usado, sem
  // id, telefone nem histórico. Contrapartida conhecida: quem digitar o
  // telefone de outro cliente vê o nome e o endereço dele; o rate limit por IP
  // abaixo limita a varredura de telefones. A equipe do balcão usa o procedure
  // autenticado admin.lookupCustomerByPhone.
  lookupByPhone: publicProcedure.input(z.object({ phone: phoneSchema })).query(async ({ input, ctx }) => {
    // Continua mais apertado que os outros endpoints, só um pouco mais alto que
    // o padrão de força bruta pra não barrar clientes legítimos atrás do mesmo
    // IP em horário de pico.
    const limit = checkRateLimit(`customer-lookup:${ctx.req.ip}`, { maxAttempts: 10 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas consultas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const customer = await getCustomerByPhone(input.phone);
    if (!customer) return undefined;
    const last = customer.addresses[0];
    return {
      firstName: firstNameOf(customer.name),
      name: customer.name,
      address: last ? { postalCode: last.postalCode ?? "", street: last.street, number: last.number, complement: last.complement ?? "", neighborhood: last.neighborhood, city: last.city, state: last.state, reference: last.reference ?? "" } : undefined,
    };
  }),
});

export { addressSchema, phoneSchema, safeText };
