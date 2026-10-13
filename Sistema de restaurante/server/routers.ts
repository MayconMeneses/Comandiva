import { COOKIE_NAME } from "@shared/const";
import { GRANTABLE_STAFF_AREAS } from "@shared/permissions";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getStaffPermissionsByUserId } from "./db/users";
import { adminRouter } from "./routers/admin";
import { catalogRouter } from "./routers/catalog";
import { customerRouter } from "./routers/customer";
import { dataRightsRouter } from "./routers/dataRights";
import { orderRouter } from "./routers/order";
import { endSupportSession, supportRouter } from "./routers/support";
import { tableRouter } from "./routers/table";
import { teamRouter } from "./routers/team";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    // Sem login real, uma sessão de suporte válida se apresenta como um
    // admin (Modo Suporte tem acesso completo via o Admin de verdade) — a
    // flag viaSupportSession deixa o frontend esconder as poucas telas que
    // ficam de fora (ver DashboardLayout.tsx/Admin.tsx). Login real sempre
    // tem prioridade se as duas sessões existirem no mesmo navegador.
    me: publicProcedure.query(async opts => {
      if (opts.ctx.user) {
        // Áreas extras liberadas (ver server/_core/permissions.ts) — admin já
        // tem tudo, então devolvemos a lista inteira pra UI não precisar de
        // um "se for admin, ignora essa checagem" espalhado pelo frontend.
        const permissions = opts.ctx.user.role === "admin" ? [...GRANTABLE_STAFF_AREAS] : await getStaffPermissionsByUserId(opts.ctx.user.id);
        return { ...opts.ctx.user, permissions };
      }
      if (!opts.ctx.supportSession) return null;
      const { restaurantName, platformAdminEmail, expiresAt } = opts.ctx.supportSession;
      return {
        role: "admin" as const,
        name: `Suporte (${platformAdminEmail})`,
        email: platformAdminEmail,
        viaSupportSession: true as const,
        supportRestaurantName: restaurantName,
        supportExpiresAt: expiresAt,
        permissions: [...GRANTABLE_STAFF_AREAS],
      };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      await endSupportSession(ctx);
      return { success: true } as const;
    }),
  }),
  catalog: catalogRouter,
  customer: customerRouter,
  dataRights: dataRightsRouter,
  order: orderRouter,
  table: tableRouter,
  admin: adminRouter,
  team: teamRouter,
  support: supportRouter,
});

export type AppRouter = typeof appRouter;
