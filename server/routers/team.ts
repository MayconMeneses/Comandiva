import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";
import { authenticateRestaurantAccount, createRestaurantAccessAccount, deleteRestaurantAccessAccount, listRestaurantAccessAccounts, setRestaurantAccessAccountActive, updateRestaurantAccessAccount } from "../db";
import { getSessionCookieOptions } from "../_core/cookies";
import { assertWithinPlanLimit } from "../_core/planLimits";
import { GRANTABLE_STAFF_AREAS } from "../_core/permissions";
import { checkRateLimit, clearRateLimit } from "../_core/rateLimit";
import { sdk } from "../_core/sdk";
import { adminOnlyProcedure, adminProcedure, publicProcedure, router } from "../_core/trpc";

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
  list: adminProcedure.query(() => listRestaurantAccessAccounts()),
  // create/update/setActive/delete ficam de fora do Modo Suporte mesmo com
  // escrita liberada no resto — gerenciar credenciais de outras contas
  // admin/staff é justamente o tipo de coisa que o usuário pediu pra manter
  // bloqueada (ver [[project_saas_whitelabel_transformation]]).
  create: adminOnlyProcedure.input(z.object({ name: z.string().trim().min(2).max(120), username: usernameSchema, password: passwordSchema, role: z.enum(["staff", "admin"]).default("staff"), permissions: permissionsSchema })).mutation(async ({ input }) => {
    await assertWithinPlanLimit("users");
    return createRestaurantAccessAccount(input);
  }),
  update: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive(), name: z.string().trim().min(2).max(120), password: passwordSchema.optional(), permissions: permissionsSchema })).mutation(({ input }) => updateRestaurantAccessAccount(input)),
  setActive: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input, ctx }) => {
    if (input.active) await assertWithinPlanLimit("users"); // reativar conta pausada também conta contra o limite do plano
    return setRestaurantAccessAccountActive(input.accountId, input.active, ctx.user.id);
  }),
  delete: adminOnlyProcedure.input(z.object({ accountId: z.number().int().positive() })).mutation(({ input, ctx }) => deleteRestaurantAccessAccount(input.accountId, ctx.user.id)),
});
