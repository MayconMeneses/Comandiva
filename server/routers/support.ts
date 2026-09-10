import { TRPCError } from "@trpc/server";
import { SUPPORT_COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import type { TrpcContext } from "../_core/context";
import { getSessionCookieOptions } from "../_core/cookies";
import { createSupportSessionToken } from "../_core/supportSession";
import { ENV } from "../_core/env";
import { checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";

// Valida a resposta do saas-core em runtime, mesmo raciocínio do V-12
// (server/_core/license.ts) — esse endpoint troca um token por uma sessão
// com acesso quase total ao restaurante, então uma resposta malformada
// precisa REJEITAR a entrada em Modo Suporte (falha fechada), nunca seguir
// em frente com dado incompleto/errado só porque o `as` cru deixaria passar.
const redeemResponseSchema = z.object({
  result: z.object({
    data: z.object({
      supportSessionId: z.number(),
      restaurantName: z.string(),
      platformAdminEmail: z.string(),
      expiresAt: z.number(),
    }),
  }),
});

/**
 * Avisa o saas-core (best-effort) que a sessão terminou e limpa o cookie
 * local — usado tanto por support.exit quanto por auth.logout (Modo Suporte
 * agora tem acesso completo via o Admin real, então "Sair" ali precisa
 * encerrar a sessão de suporte também, não só o login normal).
 */
export async function endSupportSession(ctx: Pick<TrpcContext, "req" | "res" | "supportSession">) {
  if (ctx.supportSession && ENV.saasCoreUrl && ENV.saasCoreApiKey) {
    await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/support.end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ supportSessionId: ctx.supportSession.supportSessionId }),
    }).catch(() => {});
  }
  ctx.res.clearCookie(SUPPORT_COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
}

export const supportRouter = router({
  /** Troca o token de handoff emitido pelo Painel Master por uma sessão local de suporte (cookie próprio). */
  enter: publicProcedure.input(z.object({ token: z.string().min(20) })).mutation(async ({ input, ctx }) => {
    // Defesa própria além do que o saas-core fizer do lado dele — troca um
    // token por sessão com acesso de leitura+escrita quase total ao
    // restaurante (ver adminProcedure/restaurantProcedure), não pode ficar
    // sem limite algum neste lado.
    const limit = checkRateLimit(`support-enter:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    if (!ENV.supportSessionSecret || !ENV.saasCoreUrl || !ENV.saasCoreApiKey) {
      throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "Modo Suporte não está habilitado neste deployment." });
    }
    // Mesma convenção de chamada de server/_core/license.ts: fetch cru, sem
    // superjson (o saas-core não usa), mesmo formato de header.
    const response = await fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/support.redeem`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token: input.token }),
    });
    if (!response.ok) throw new TRPCError({ code: "FORBIDDEN", message: "Link de suporte inválido, expirado ou já utilizado." });
    const parsed = redeemResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resposta inesperada do Painel Master ao validar o link de suporte." });
    const data = parsed.data.result.data;

    const token = await createSupportSessionToken(data);
    ctx.res.cookie(SUPPORT_COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: data.expiresAt - Date.now() });
    return { success: true, restaurantName: data.restaurantName, expiresAt: data.expiresAt };
  }),

  me: publicProcedure.query(({ ctx }) => ctx.supportSession),

  exit: publicProcedure.mutation(async ({ ctx }) => {
    await endSupportSession(ctx);
    return { success: true } as const;
  }),
});
