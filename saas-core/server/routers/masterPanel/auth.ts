import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticatePlatformAdmin } from "../../db/platformAdmins";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { getPlatformSessionCookieOptions } from "../../_core/platformCookies";
import { createPlatformSessionToken } from "../../_core/platformSession";
import { checkRateLimit, clearRateLimit } from "../../_core/rateLimit";
import { ENV } from "../../_core/env";
import { publicProcedure, router } from "../../_core/trpc";

export const masterPanelAuthRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.platformAdmin),

  login: publicProcedure.input(z.object({ email: z.string().trim().email(), password: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const email = input.email.trim().toLowerCase();
    const rateLimitKey = `platform-login:${ctx.req.ip}:${email}`;
    const limit = checkRateLimit(rateLimitKey);
    if (!limit.allowed) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    }

    const admin = await authenticatePlatformAdmin(email, input.password);
    if (!admin) {
      await recordPlatformAuditLog({ actorLabel: email, action: "admin.login_failed", ip: ctx.req.ip });
      throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
    }
    clearRateLimit(rateLimitKey);

    const token = await createPlatformSessionToken(admin.id, admin.email);
    ctx.res.cookie(ENV.platformSessionCookieName, token, getPlatformSessionCookieOptions(ctx.req));
    await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.login_success", ip: ctx.req.ip });
    return { name: admin.name, email: admin.email };
  }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.platformAdmin) {
      await recordPlatformAuditLog({ actorAdminId: ctx.platformAdmin.id, actorLabel: ctx.platformAdmin.email, action: "admin.logout", ip: ctx.req.ip });
    }
    ctx.res.clearCookie(ENV.platformSessionCookieName, { ...getPlatformSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
