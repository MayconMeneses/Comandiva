import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { planKeyValues } from "../../drizzle/schema";
import { listPlansWithFeaturesAndLimits, listAllFeatures } from "../db/plans";
import { attachMpPreference, createSignupPayment, getSignupPaymentById } from "../db/signupPayments";
import { getRestaurantById } from "../db/restaurants";
import { createImplementationFeePreference } from "../_core/mercadoPagoCheckout";
import { buildMenuReferenceCaption, sendTelegramDocumentAsync } from "../_core/telegramService";
import { ENV } from "../_core/env";
import { checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";

const ALLOWED_MENU_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_MENU_FILE_BYTES = 8 * 1024 * 1024; // 8MB — cabe folgado num cardápio em PDF/foto, sem pesar o body limit do express

// Taxa de implementação — ver client/src/pages/comercial/Planos.tsx pro
// mesmo valor exibido.
const IMPLEMENTATION_FEE_CENTS = 15000;

/**
 * Único namespace acessível sem token de operador, API key de restaurante ou
 * sessão de admin — a porta de entrada do site comercial público.
 *
 * `signup` NÃO cria o restaurante direto — grava a intenção de cadastro
 * (`signup_payments`, status "pending") e devolve um checkout do Mercado
 * Pago pra taxa de implementação. O restaurante só nasce de verdade quando
 * o webhook (server/_core/mercadoPagoSignupWebhook.ts) confirma o
 * pagamento aprovado — nunca antes, nunca só pelo retorno da URL.
 */
export const publicRouter = router({
  plans: publicProcedure.query(async () => {
    const [allPlans, allFeatures] = await Promise.all([listPlansWithFeaturesAndLimits(), listAllFeatures()]);
    const featureNameById = new Map(allFeatures.map(feature => [feature.featureId, feature.name]));
    const activePlans = allPlans.filter(plan => plan.active);
    return {
      plans: activePlans.map(plan => ({ ...plan, featureNames: plan.features.map(featureId => featureNameById.get(featureId) ?? featureId) })),
      // Catálogo completo, na mesma ordem de seed-plans.ts — a página
      // comercial usa isto pra montar a tabela comparativa completa
      // (✅/🔒 por recurso x plano), não só a lista do que cada plano tem.
      allFeatures: allFeatures.map(feature => ({ featureId: feature.featureId, name: feature.name })),
    };
  }),

  signup: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        planKey: z.enum(planKeyValues),
        contactName: z.string().trim().max(160).optional(),
        contactEmail: z.string().trim().email(),
        contactPhone: z.string().trim().max(24).optional(),
        // Origem do site (ex.: "https://mmsystemcreator.com") — usada só pra
        // montar as URLs de volta do checkout. Nunca a URL inteira (evita
        // open redirect: sempre concatenamos caminhos fixos aqui, nunca
        // aceitamos um path vindo do cliente).
        returnOrigin: z.string().url(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Mesma janela/limite do login do Painel Master (8 tentativas/10min) —
      // essa mutation cria dado de verdade sem nenhum token, então precisa
      // de proteção contra abuso.
      const rateLimitKey = `public-signup:${ctx.req.ip}`;
      const limit = checkRateLimit(rateLimitKey);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).`,
        });
      }

      // z.enum(planKeyValues) só garante que a chave existe — não que o
      // plano ainda está ativo pra venda. Um visitante (ao contrário do
      // operador via CLI) pode enviar qualquer coisa, então confere de novo.
      const activePlans = await listPlansWithFeaturesAndLimits();
      const plan = activePlans.find(candidate => candidate.key === input.planKey && candidate.active);
      if (!plan) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plano indisponível no momento." });
      }
      if (!ENV.mercadoPagoAccessToken) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cobrança automática não está configurada no momento. Tente novamente mais tarde." });
      }

      const { id: signupPaymentId } = await createSignupPayment({
        payload: {
          name: input.name,
          planKey: input.planKey,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
        },
        amountCents: IMPLEMENTATION_FEE_CENTS,
      });

      const origin = input.returnOrigin.replace(/\/$/, "");
      const preference = await createImplementationFeePreference({
        accessToken: ENV.mercadoPagoAccessToken,
        title: "Taxa de implementação — MM System Creator",
        externalReference: String(signupPaymentId),
        amountCents: IMPLEMENTATION_FEE_CENTS,
        payerEmail: input.contactEmail,
        successUrl: `${origin}/comercial/cadastro/confirmando?ref=${signupPaymentId}`,
        pendingUrl: `${origin}/comercial/cadastro/confirmando?ref=${signupPaymentId}`,
        failureUrl: `${origin}/comercial/cadastro/${input.planKey}?pagamento=falhou`,
      });
      await attachMpPreference(signupPaymentId, preference.id);

      return { checkoutUrl: preference.initPoint, signupPaymentId };
    }),

  signupStatus: publicProcedure.input(z.object({ signupPaymentId: z.number().int().positive() })).query(async ({ input }) => {
    const row = await getSignupPaymentById(input.signupPaymentId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND" });
    return { status: row.status, restaurantId: row.restaurantId };
  }),

  /**
   * Cliente manda o cardápio (PDF/foto/Word) logo depois do cadastro, pra
   * adiantar a organização manual da equipe. O arquivo NUNCA é salvo aqui —
   * só repassado como anexo pro Telegram do dono (ver telegramService.ts e o
   * limite documentado em drizzle/schema/restaurants.ts: cardápio do
   * restaurante nunca vive no saas-core, só no deployment próprio dele).
   */
  uploadMenuReference: publicProcedure
    .input(
      z.object({
        restaurantId: z.number().int().positive(),
        fileName: z.string().trim().min(1).max(200),
        mimeType: z.string(),
        fileBase64: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const rateLimitKey = `public-menu-upload:${ctx.req.ip}`;
      const limit = checkRateLimit(rateLimitKey);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).`,
        });
      }

      if (!ALLOWED_MENU_MIME_TYPES.has(input.mimeType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Formato não aceito. Envie PDF, Word, PNG, JPG ou WEBP." });
      }

      const restaurant = await getRestaurantById(input.restaurantId);
      if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      if (fileBuffer.byteLength === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo vazio." });
      if (fileBuffer.byteLength > MAX_MENU_FILE_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Arquivo maior que 8MB. Envie uma versão mais leve." });
      }

      sendTelegramDocumentAsync({
        fileBuffer,
        fileName: input.fileName,
        mimeType: input.mimeType,
        caption: buildMenuReferenceCaption({ restaurantId: restaurant.id, restaurantName: restaurant.name }),
      });

      return { success: true as const };
    }),
});
