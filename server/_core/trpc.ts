import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getStaffPermissionsByUserId } from "../db/users";
import { sendOwnerAlert } from "./alerts";
import type { TrpcContext } from "./context";
import { ENV } from "./env";
import { getLicenseSnapshot, type FeatureId } from "./license";
import type { StaffPermissionArea } from "./permissions";

export type FeatureLockedInfo = { featureId: FeatureId; requiredPlanKey: string | null; requiredPlanName: string | null };

// appRouter (../routers.ts) aninha cada arquivo de router num namespace
// próprio — o primeiro segmento do `path` do tRPC já diz de qual área do
// sistema veio o erro, sem precisar caçar isso no código toda vez que um
// alerta chega. Mantido perto do errorFormatter (único lugar que usa isso).
const AREA_BY_NAMESPACE: Record<string, string> = {
  admin: "Painel administrativo",
  catalog: "Cardápio público",
  order: "Pedido (checkout/acompanhamento)",
  customer: "Cadastro de cliente",
  dataRights: "Portal de dados pessoais (LGPD)",
  table: "Mesas (QR Code + painel operacional)",
  support: "Modo Suporte",
  system: "Sistema",
  auth: "Autenticação",
};
export function describeArea(path: string | undefined): string {
  const namespace = path?.split(".")[0];
  return (namespace && AREA_BY_NAMESPACE[namespace]) || "Pub X (área desconhecida)";
}

/**
 * Decide se um erro de requisição merece alerta pro dono e dispara se sim —
 * extraído do errorFormatter abaixo só pra dar pra testar essa decisão
 * isoladamente (server/trpc-error-alert.test.ts), sem precisar simular uma
 * requisição HTTP real (createCaller() NÃO passa pelo errorFormatter — só o
 * adaptador HTTP de verdade faz isso).
 */
export function alertOnUnintentionalInternalError(error: { code: string; cause?: unknown }, path: string | undefined): boolean {
  // Uma exceção não tratada (erro do driver do banco, de uma API externa
  // etc.) chega aqui auto-empacotada pelo próprio tRPC como TRPCError com
  // `cause` = o erro original — nesse caso error.message é a mensagem CRUA
  // do erro interno. Um TRPCError lançado por nós de propósito (ex.:
  // "Banco de dados indisponível") nunca define `cause`, então não cai
  // aqui e mantém a mensagem curada normalmente.
  const isUnintentionalInternalError = error.code === "INTERNAL_SERVER_ERROR" && error.cause instanceof Error && !(error.cause instanceof ZodError);
  if (isUnintentionalInternalError) {
    console.error("[trpc] Erro interno não tratado:", error.cause);
    // Mesmo canal (Telegram/e-mail/webhook) já usado pra uncaughtException —
    // aqui é o caso "menor" (um endpoint falhou, servidor continua de pé),
    // por isso kind próprio ("trpcInternalError") com seu próprio throttle
    // de 10min, em vez de competir pela janela do crash total do processo.
    void sendOwnerAlert(`Erro interno numa requisição (${path ?? "endpoint desconhecido"})`, (error.cause as Error).stack ?? (error.cause as Error).message, "trpcInternalError", undefined, describeArea(path));
  }
  return isUnintentionalInternalError;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error, path }) {
    const cause = error.cause as { featureLocked?: FeatureLockedInfo } | undefined;
    // Erro de validação (Zod) chega em error.cause com a mensagem já amigável
    // em cada issue — sem isso, shape.message vira o JSON bruto de issues[],
    // que os formulários mostram direto pro usuário final (ex: campo "usuário").
    const zodMessage = error.cause instanceof ZodError ? error.cause.issues[0]?.message : undefined;
    const isUnintentionalInternalError = alertOnUnintentionalInternalError(error, path);
    return {
      ...shape,
      message: zodMessage ?? (isUnintentionalInternalError ? "Erro interno. Tente novamente." : shape.message),
      data: cause?.featureLocked ? { ...shape.data, featureLocked: cause.featureLocked } : shape.data,
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Guarda "só usuário real" — sem fallback de sessão de suporte, pros pontos
 * mais sensíveis que ficam de fora do Modo Suporte mesmo com escrita liberada
 * no resto: credenciais de gateway de pagamento e gestão de outras contas
 * admin/staff (ver server/routers/admin/paymentGateways.ts e team.ts).
 */
export const adminOnlyProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Reporta pro saas-core (best-effort) toda mutation feita sob uma sessão de
// suporte — nunca sob login real, e nunca deixa uma falha de rede derrubar a
// mutation em si. Ver saas-core/server/routers/support.ts::logWrite.
function reportSupportWrite(procedurePath: string, supportSession: NonNullable<TrpcContext["supportSession"]>) {
  if (!ENV.saasCoreUrl || !ENV.saasCoreApiKey) return;
  fetch(`${ENV.saasCoreUrl.replace(/\/+$/, "")}/api/trpc/support.logWrite`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV.saasCoreApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ supportSessionId: supportSession.supportSessionId, procedurePath }),
  }).catch(() => {});
}

const auditSupportWrite = t.middleware(async ({ ctx, next, path, type }) => {
  const result = await next();
  if (result.ok && type === "mutation" && !ctx.user && ctx.supportSession) {
    reportSupportWrite(path, ctx.supportSession);
  }
  return result;
});

/**
 * Aceita admin real OU uma sessão de suporte válida — Modo Suporte tem acesso
 * de leitura E escrita completo por padrão; os poucos pontos que devem ficar
 * de fora mesmo em modo suporte usam adminOnlyProcedure acima em vez desta.
 * Sessão real sempre tem prioridade se as duas existirem no mesmo navegador.
 * Toda mutation feita sob sessão de suporte é reportada ao saas-core
 * (auditSupportWrite) — ver [[project_saas_whitelabel_transformation]].
 */
export const adminProcedure = t.procedure
  .use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (ctx.user && ctx.user.role === "admin") return next({ ctx: { ...ctx, user: ctx.user } });
      if (ctx.supportSession) return next({ ctx: { ...ctx, user: null, supportSession: ctx.supportSession } });
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }),
  )
  .use(auditSupportWrite);

export const restaurantProcedure = t.procedure
  .use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      if (ctx.user && (ctx.user.role === "admin" || ctx.user.role === "staff")) return next({ ctx: { ...ctx, user: ctx.user } });
      if (ctx.supportSession) return next({ ctx: { ...ctx, user: null, supportSession: ctx.supportSession } });
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }),
  )
  .use(auditSupportWrite);

/**
 * Igual `restaurantProcedure` (admin sempre passa, sessão de suporte sempre
 * passa — ambos já têm acesso total), mas uma conta STAFF só passa se essa
 * área específica estiver na lista de permissões extras dela (ver
 * server/_core/permissions.ts). Sem nenhuma permissão extra configurada
 * (`permissions: null`, o padrão), staff continua exatamente como hoje: sem
 * acesso a essas áreas — isso é aditivo, nunca tira acesso de ninguém.
 */
export function restaurantProcedureFor(area: StaffPermissionArea) {
  return t.procedure
    .use(
      t.middleware(async opts => {
        const { ctx, next } = opts;
        if (ctx.user?.role === "admin") return next({ ctx: { ...ctx, user: ctx.user } });
        if (ctx.supportSession) return next({ ctx: { ...ctx, user: null, supportSession: ctx.supportSession } });
        if (ctx.user?.role === "staff") {
          const areas = await getStaffPermissionsByUserId(ctx.user.id);
          if (areas.includes(area)) return next({ ctx: { ...ctx, user: ctx.user } });
        }
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }),
    )
    .use(auditSupportWrite);
}

/**
 * Middleware de gate por plano — empilhável em cima de qualquer procedure
 * (public/protected/admin/restaurant) quando o endpoint precisa também
 * checar se o plano atual do restaurante libera essa feature. O erro carrega
 * `featureLocked` (via errorFormatter acima) pro frontend distinguir "sem
 * permissão" de "bloqueado por plano" e oferecer upgrade em vez de só negar.
 */
/**
 * Mesma checagem de `requireFeature`, mas como função simples em vez de
 * middleware — usada quando o gate por plano é CONDICIONAL ao conteúdo do
 * input (ex.: só travar a criação de staff quando o input pede permissão
 * granular), não em todo o procedure. Lança o mesmo formato de erro
 * (`featureLocked`) pro frontend tratar igual em qualquer um dos dois casos.
 */
export async function assertFeatureAvailable(featureId: FeatureId) {
  const snapshot = await getLicenseSnapshot();
  if (!snapshot.features.includes(featureId)) {
    const required = snapshot.lockedFeatures[featureId];
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Este recurso não está disponível no plano ${snapshot.planKey}.`,
      cause: {
        featureLocked: {
          featureId,
          requiredPlanKey: required?.requiredPlanKey ?? null,
          requiredPlanName: required?.requiredPlanName ?? null,
        } satisfies FeatureLockedInfo,
      },
    });
  }
}

export function requireFeature(featureId: FeatureId) {
  return t.middleware(async ({ next }) => {
    await assertFeatureAvailable(featureId);
    return next();
  });
}

/** Açúcar pro caso público (mesa/QR): equivalente a publicProcedure.use(requireFeature(...)). */
export const featureProcedure = (featureId: FeatureId) => t.procedure.use(requireFeature(featureId));
