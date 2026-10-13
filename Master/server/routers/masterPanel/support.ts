import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getRestaurantById } from "../../db/restaurants";
import { createSupportSession, getSupportSessionByIdAnyRestaurant, listActiveSupportSessions, markSupportSessionEnded } from "../../db/supportSessions";
import { getPlatformAdminById } from "../../db/platformAdmins";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { buildSupportEntryMessage, sendTelegramMessageAsync } from "../../_core/telegramService";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

export const masterPanelSupportRouter = router({
  start: platformAdminProcedureFor("modo_suporte").input(z.object({ restaurantId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const restaurant = await getRestaurantById(input.restaurantId);
    if (!restaurant) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
    if (restaurant.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Este restaurante está suspenso/cancelado — não é possível entrar em modo suporte." });
    }
    if (!restaurant.deploymentUrl) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Configure a URL de deployment deste restaurante antes de usar o Modo Suporte." });
    }

    const { token, expiresAt } = await createSupportSession({
      restaurantId: restaurant.id,
      platformAdminId: ctx.platformAdmin.id,
      issuedFromIp: ctx.req.ip,
    });
    // Quem emitiu o link fica registrado ANTES de qualquer entrada (a entrada em si é auditada no resgate).
    await recordPlatformAuditLog({
      actorAdminId: ctx.platformAdmin.id,
      actorLabel: ctx.platformAdmin.email,
      action: "support.link_issued",
      entityType: "restaurant",
      entityId: restaurant.id,
      ip: ctx.req.ip,
    });
    // Alerta em tempo real: quem abriu o Modo Suporte em qual restaurante, de que IP, a que horas.
    // Montar o aviso nunca pode impedir o Modo Suporte de abrir (try/catch), mesma regra de sendTelegramMessageAsync.
    try {
      sendTelegramMessageAsync(buildSupportEntryMessage({ adminEmail: ctx.platformAdmin.email, restaurantName: restaurant.name, restaurantId: restaurant.id, ip: ctx.req.ip ?? "desconhecido" }));
    } catch (error) {
      console.error("[support] Falha ao montar o alerta de entrada em Modo Suporte:", error);
    }
    const base = restaurant.deploymentUrl.replace(/\/+$/, "");
    // Token no FRAGMENTO (#token=...): o navegador nunca o envia a servidor, proxy, log nem Referer.
    return { entryUrl: `${base}/suporte/entrar#token=${encodeURIComponent(token)}`, expiresAt };
  }),

  /** Sessões de suporte em andamento (para encerrar uma à força). */
  listActive: platformAdminProcedureFor("modo_suporte").query(async () => {
    const sessions = await listActiveSupportSessions();
    return Promise.all(
      sessions.map(async session => {
        const [restaurant, admin] = await Promise.all([getRestaurantById(session.restaurantId), getPlatformAdminById(session.platformAdminId)]);
        return {
          id: session.id,
          restaurantId: session.restaurantId,
          restaurantName: restaurant?.name ?? `#${session.restaurantId}`,
          adminEmail: admin?.email ?? "desconhecido",
          usedAt: session.usedAt,
          expiresAt: session.expiresAt,
        };
      }),
    );
  }),

  /** Encerra a sessão agora: o restaurante deixa de aceitá-la em até ~15 s (cache do deployment). */
  end: platformAdminProcedureFor("modo_suporte").input(z.object({ supportSessionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const session = await getSupportSessionByIdAnyRestaurant(input.supportSessionId);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Sessão de suporte não encontrada." });
    if (!session.endedAt) await markSupportSessionEnded(session.id);
    await recordPlatformAuditLog({
      actorAdminId: ctx.platformAdmin.id,
      actorLabel: ctx.platformAdmin.email,
      action: "support.ended_by_master",
      entityType: "restaurant",
      entityId: session.restaurantId,
      after: { supportSessionId: session.id },
      ip: ctx.req.ip,
    });
    return { success: true } as const;
  }),
});
