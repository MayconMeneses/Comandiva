import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getPlatformAdminById } from "../db/platformAdmins";
import { recordPlatformAuditLog } from "../db/auditLog";
import { getOwnSupportSession, getSupportSessionById, markSupportSessionEnded, markSupportSessionUsed } from "../db/supportSessions";
import { hashSupportToken } from "../_core/supportToken";
import { restaurantProcedure, router } from "../_core/trpc";

function actorLabelFor(admin: Awaited<ReturnType<typeof getPlatformAdminById>>, platformAdminId: number) {
  return admin ? `platform_admin:${admin.email}` : `platform_admin:#${platformAdminId}`;
}

/**
 * Chamado pelo DEPLOYMENT do restaurante (via a própria API key, igual
 * sync.mySnapshot) — nunca diretamente pelo navegador do Super Admin.
 */
export const supportRouter = router({
  redeem: restaurantProcedure.input(z.object({ token: z.string().min(20) })).mutation(async ({ input, ctx }) => {
    const tokenHash = hashSupportToken(input.token);
    // CRÍTICO: filtra sempre por ctx.restaurant.id (resolvido da própria API
    // key de quem chama) — nunca por um restaurantId enviado no input. "Token
    // existe mas é de outro restaurante" e "token não existe" devolvem o
    // MESMO erro, pra não vazar essa distinção pra quem está adivinhando.
    const session = await getOwnSupportSession(ctx.restaurant.id, tokenHash);
    if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Link de suporte inválido." });
    if (session.usedAt) throw new TRPCError({ code: "CONFLICT", message: "Link de suporte já foi utilizado." });
    if (Date.now() > session.expiresAt) throw new TRPCError({ code: "FORBIDDEN", message: "Link de suporte expirado." });

    const marked = await markSupportSessionUsed(session.id);
    if (!marked) throw new TRPCError({ code: "CONFLICT", message: "Link de suporte já foi utilizado." });

    const admin = await getPlatformAdminById(session.platformAdminId);
    await recordPlatformAuditLog({
      actorAdminId: session.platformAdminId,
      actorLabel: actorLabelFor(admin, session.platformAdminId),
      action: "support.entered",
      entityType: "restaurant",
      entityId: ctx.restaurant.id,
      after: { supportSessionId: session.id },
      ip: session.issuedFromIp ?? undefined,
    });

    return {
      supportSessionId: session.id,
      restaurantName: ctx.restaurant.name,
      platformAdminEmail: admin?.email ?? "desconhecido",
      expiresAt: session.expiresAt,
    };
  }),

  /**
   * Registra uma mutation feita durante uma sessão de suporte ativa — Modo
   * Suporte tem escrita liberada (exceto credenciais/pagamento, bloqueadas no
   * próprio deployment do restaurante), então cada alteração feita fica
   * auditada aqui, não só a entrada/saída da sessão. Chamado pelo deployment
   * do restaurante a cada mutation bem-sucedida sob sessão de suporte (ver
   * server/_core/trpc.ts::auditSupportWrite no app principal) — tolerante a
   * sessão já encerrada/inexistente, mesmo espírito de `end` abaixo.
   */
  logWrite: restaurantProcedure.input(z.object({ supportSessionId: z.number().int().positive(), procedurePath: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
    const session = await getSupportSessionById(ctx.restaurant.id, input.supportSessionId);
    if (!session || !session.usedAt || session.endedAt) return { success: true } as const;
    const admin = await getPlatformAdminById(session.platformAdminId);
    await recordPlatformAuditLog({
      actorAdminId: session.platformAdminId,
      actorLabel: actorLabelFor(admin, session.platformAdminId),
      action: "support.write",
      entityType: "restaurant",
      entityId: ctx.restaurant.id,
      after: { supportSessionId: session.id, procedurePath: input.procedurePath },
      ip: session.issuedFromIp ?? undefined,
    });
    return { success: true } as const;
  }),

  end: restaurantProcedure.input(z.object({ supportSessionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const session = await getSupportSessionById(ctx.restaurant.id, input.supportSessionId);
    // Tolerante (igual auth.logout do app principal): sessão inexistente,
    // nunca resgatada ou já encerrada simplesmente não faz nada.
    if (!session || !session.usedAt || session.endedAt) return { success: true } as const;

    await markSupportSessionEnded(session.id);
    const admin = await getPlatformAdminById(session.platformAdminId);
    await recordPlatformAuditLog({
      actorAdminId: session.platformAdminId,
      actorLabel: actorLabelFor(admin, session.platformAdminId),
      action: "support.ended",
      entityType: "restaurant",
      entityId: ctx.restaurant.id,
      after: { supportSessionId: session.id },
      ip: session.issuedFromIp ?? undefined,
    });
    return { success: true } as const;
  }),
});
