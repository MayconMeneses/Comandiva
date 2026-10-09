import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { planKeyValues } from "../../drizzle/schema";
import { listPlansWithFeaturesAndLimits, listPlansWithFeaturesAndLimitsCached, listAllFeatures } from "../db/plans";
import { getSignupPaymentById } from "../db/signupPayments";
import { createRestaurantFromPublicSignup } from "../db/publicSignup";
import { getRestaurantById } from "../db/restaurants";
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

/**
 * Único namespace acessível sem token de operador, API key de restaurante ou
 * sessão de admin — a porta de entrada do site comercial público.
 *
 * `signup` cria o restaurante direto, SEM pagamento (a taxa de implementação
 * saiu do fluxo em 2026-10-09) e avisa o dono no Telegram — ver
 * server/db/publicSignup.ts. O webhook de taxa (mercadoPagoSignupWebhook.ts)
 * continua só pra cadastros antigos que ficaram pendentes.
 */
export const publicRouter = router({
  plans: publicProcedure.query(async () => {
    const [allPlans, allFeatures] = await Promise.all([listPlansWithFeaturesAndLimitsCached(), listAllFeatures()]);
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
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Mesma janela/limite do login do Painel Master (8 tentativas/10min) —
      // essa mutation cria dado de verdade sem nenhum token (e, sem a taxa de
      // implementação, sem nenhuma barreira de pagamento), então precisa de
      // proteção contra abuso.
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

      const { restaurantId } = await createRestaurantFromPublicSignup({
        name: input.name,
        planKey: input.planKey,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
      });
      return { restaurantId };
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
        notes: z.string().trim().max(2000).optional(),
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
        caption: buildMenuReferenceCaption({ restaurantId: restaurant.id, restaurantName: restaurant.name, notes: input.notes }),
      });

      return { success: true as const };
    }),
});
