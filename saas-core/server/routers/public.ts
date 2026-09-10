import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { planKeyValues } from "../../drizzle/schema";
import { createRestaurantWithSubscription } from "../db/restaurants";
import { listPlansWithFeaturesAndLimits, listAllFeatures } from "../db/plans";
import { recordPlatformAuditLog } from "../db/auditLog";
import { checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";

/**
 * Único namespace acessível sem token de operador, API key de restaurante ou
 * sessão de admin — a porta de entrada do site comercial público. Nada aqui
 * lê/escreve fora de `restaurants`/`subscriptions` (via as mesmas funções
 * que `restaurants.create` já usa), então o Painel Master e a licença dos
 * restaurantes existentes não são afetados.
 */
export const publicRouter = router({
  plans: publicProcedure.query(async () => {
    const [allPlans, allFeatures] = await Promise.all([listPlansWithFeaturesAndLimits(), listAllFeatures()]);
    const featureNameById = new Map(allFeatures.map(feature => [feature.featureId, feature.name]));
    return allPlans
      .filter(plan => plan.active)
      .map(plan => ({ ...plan, featureNames: plan.features.map(featureId => featureNameById.get(featureId) ?? featureId) }));
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

      const result = await createRestaurantWithSubscription({ ...input, actor: "public:signup" });

      // Nunca devolve a API key em texto puro pra um visitante não
      // autenticado — ela só é necessária depois, quando a equipe provisiona
      // de fato o deployment isolado desse cliente (etapa manual, fora daqui).
      await recordPlatformAuditLog({
        actorLabel: input.contactEmail,
        action: "restaurant.public_signup",
        entityType: "restaurant",
        entityId: result.restaurantId,
        after: { planKey: result.planKey, status: result.status },
        ip: ctx.req.ip,
      });

      return { restaurantId: result.restaurantId, planKey: result.planKey };
    }),
});
