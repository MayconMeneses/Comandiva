import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { authenticateRestaurantAccount, createRestaurantAccessAccount, deleteRestaurantAccessAccount, getStoredStaffPermissions, listRestaurantAccessAccounts, recordAccountAudit, setRestaurantAccessAccountActive, updateRestaurantAccessAccount } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { assertWithinPlanLimit, assertWithinPlanLimitAndInsert } from "../_core/planLimits";
import { GRANTABLE_STAFF_AREAS } from "../_core/permissions";
import { checkRateLimit, clearRateLimit } from "../_core/rateLimit";
import { sdk } from "../_core/sdk";
import { adminOnlyProcedure, assertFeatureAvailable, publicProcedure, router } from "../_core/trpc";

const usernameSchema = z.string().trim().toLowerCase().min(3, "Use ao menos 3 caracteres.").max(64).regex(/^[a-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado.");
const passwordSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128);
const permissionsSchema = z.array(z.enum(GRANTABLE_STAFF_AREAS)).nullable().optional();

export const teamRouter = router({
  login: publicProcedure.input(z.object({ username: usernameSchema, password: passwordSchema })).mutation(async ({ input, ctx }) => {
    const rateLimitKey = `login:${ctx.req.ip}:${input.username.toLowerCase()}`;
    const limit = checkRateLimit(rateLimitKey);
    if (!limit.allowed) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    }
    const account = await authenticateRestaurantAccount(input.username, input.password);
    if (!account) throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
    clearRateLimit(rateLimitKey);
    const token = await sdk.createSessionToken(account.user.openId, { name: account.user.name ?? account.credential.username });
    ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
    return { name: account.user.name, role: account.user.role };
  }),
  // list também fica de fora do Modo Suporte (adminOnlyProcedure, não
  // adminProcedure) — a lista já devolve usuário, papel, permissões e último
  // login de cada conta admin/staff do restaurante, o mesmo tipo de dado
  // sensível que create/update/setActive/delete abaixo protegem.
  // create/update/setActive/delete ficam de fora do Modo Suporte mesmo com
  // escrita liberada no resto — gerenciar credenciais de outras contas
  // admin/staff é justamente o tipo de coisa que o usuário pediu pra manter
  // bloqueada (ver [[project_saas_whitelabel_transformation]]).
  list: adminOnlyProcedure.query(() => listRestaurantAccessAccounts()),
  create: adminOnlyProcedure.input(z.object({ name: z.string().trim().min(2).max(120), username: usernameSchema, password: passwordSchema, role: z.enum(["staff", "admin"]).default("staff"), permissions: permissionsSchema })).mutation(async ({ input, ctx }) => {
    // Escolher áreas específicas (em vez de deixar a conta staff só com o
    // básico de pedidos/mesas) é recurso de plano (Premium) desde a
    // reestruturação de planos, 2026-09-11 — checagem condicional ao input,
    // não no procedure inteiro, porque criar staff sem nenhuma área extra
    // continua liberado em qualquer plano.
    if (input.permissions && input.permissions.length > 0) await assertFeatureAvailable("advanced_team");
    const created = await assertWithinPlanLimitAndInsert("users", tx => createRestaurantAccessAccount(input, tx));
    // Sem senha nenhuma no log — só o que é seguro de aparecer na tela de
    // Auditoria (achado M1: antes, criar/pausar/excluir conta não deixava
    // rastro nenhum).
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "team.created", entityType: "user", entityId: created.userId, after: { username: created.username, role: created.role, name: created.name }, ip: ctx.req.ip });
    return created;
  }),
  update: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive(), name: z.string().trim().min(2).max(120), password: passwordSchema.optional(), permissions: permissionsSchema })).mutation(async ({ input, ctx }) => {
    // Mesmo gate do create acima, mas só trava se a restrição estiver
    // MUDANDO de verdade (comparado ao que já está salvo) — editar nome/senha
    // de uma conta já restrita, sem tocar nas áreas, nunca deve travar, senão
    // quebraríamos contas configuradas antes desta regra existir (regra de
    // não quebrar configuração existente).
    // currentPermissions só é buscado quando realmente precisa (mesma
    // condição de antes) — não vira uma chamada extra ao banco em toda
    // edição, e o log de auditoria abaixo não depende dele: registra o que
    // foi enviado no input, não um diff contra o estado anterior.
    if (input.permissions && input.permissions.length > 0) {
      const currentPermissions = await getStoredStaffPermissions(input.accountId);
      const changed = currentPermissions.length !== input.permissions.length || !input.permissions.every(area => currentPermissions.includes(area));
      if (changed) await assertFeatureAvailable("advanced_team");
    }
    const result = await updateRestaurantAccessAccount(input);
    await recordAccountAudit({
      actorUserId: ctx.user.id,
      actorName: ctx.user.name ?? ctx.user.openId,
      action: "team.updated",
      entityType: "user",
      entityId: input.accountId,
      after: { name: input.name, permissions: input.permissions, passwordChanged: Boolean(input.password) },
      ip: ctx.req.ip,
    });
    return result;
  }),
  setActive: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input, ctx }) => {
    if (input.active) await assertWithinPlanLimit("users"); // reativar conta pausada também conta contra o limite do plano
    const result = await setRestaurantAccessAccountActive(input.accountId, input.active, ctx.user.id);
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: input.active ? "team.reactivated" : "team.paused", entityType: "user", entityId: input.accountId, after: { active: input.active }, ip: ctx.req.ip });
    return result;
  }),
  delete: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const result = await deleteRestaurantAccessAccount(input.accountId, ctx.user.id);
    await recordAccountAudit({ actorUserId: ctx.user.id, actorName: ctx.user.name ?? ctx.user.openId, action: "team.deleted", entityType: "user", entityId: input.accountId, ip: ctx.req.ip });
    return result;
  }),
});
