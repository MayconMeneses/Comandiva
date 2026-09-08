import { initTRPC, TRPCError } from "@trpc/server";
import { timingSafeEqual } from "node:crypto";
import type { TrpcContext } from "./context";
import { ENV } from "./env";
import type { MasterPermissionArea } from "./permissions";

// Sem superjson de propósito: datas já são epoch-ms em todo o schema (nunca
// Date/Map/Set no payload), então JSON puro basta — tanto pro `fetch` cru da
// sincronização de cada deployment quanto pro client do Painel Master
// (client/src/lib/trpc.ts). Se o frontend um dia precisar de superjson,
// precisa ser adicionado aqui E lá ao mesmo tempo, ou client/servidor
// discordam do formato do payload.
const t = initTRPC.context<TrpcContext>().create({});

export const router = t.router;
export const publicProcedure = t.procedure;

export const restaurantProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.restaurant || ctx.restaurant.status !== "active") {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Chave de API inválida ou inativa." });
    }
    return next({ ctx: { ...ctx, restaurant: ctx.restaurant } });
  }),
);

/**
 * Gate do Painel Master — exige uma sessão de Super Admin válida (cookie),
 * nunca uma API key de restaurante nem o token de operador. Estrutural e
 * fisicamente separado de `restaurantProcedure`/`operatorProcedure`: os três
 * lêem campos diferentes de `ctx`, populados por canais diferentes em
 * `context.ts` — não há como um satisfazer o outro.
 */
export const platformAdminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.platformAdmin || !ctx.platformAdmin.active) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de administrador inválida ou expirada." });
    }
    return next({ ctx: { ...ctx, platformAdmin: ctx.platformAdmin } });
  }),
);

/**
 * Igual `platformAdminProcedure` (sessão válida obrigatória), mas exige que
 * a conta tenha esta área específica liberada — "owner" sempre passa (tem
 * todas as áreas por definição, ver server/db/platformAdmins.ts), "member"
 * só passa se a área estiver em `permissions`. Mesmo padrão de
 * `restaurantProcedureFor` no app principal (server/_core/trpc.ts de lá).
 */
export function platformAdminProcedureFor(area: MasterPermissionArea) {
  return t.procedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.platformAdmin || !ctx.platformAdmin.active) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de administrador inválida ou expirada." });
      }
      if (!ctx.platformAdmin.permissions.includes(area)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta não tem acesso a esta área do Painel Master." });
      }
      return next({ ctx: { ...ctx, platformAdmin: ctx.platformAdmin } });
    }),
  );
}

function timingSafeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export const operatorProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    const token = ctx.req.headers["x-operator-token"];
    if (!ENV.operatorToken || typeof token !== "string" || !timingSafeCompare(token, ENV.operatorToken)) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Token de operador inválido." });
    }
    return next({ ctx });
  }),
);
