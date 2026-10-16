import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { recordPlatformAuditLog } from "../../db/auditLog";
import {
  clearPlatformAdminSecurityAnswers,
  getPlatformAdminSecurityRecord,
  revokeAllPlatformAdminSessions,
  setPlatformAdminSecurityAnswers,
} from "../../db/platformAdminSecurity";
import { getClientIp } from "../../_core/clientIp";
import { ENV } from "../../_core/env";
import { issueSession } from "../../_core/issueSession";
import { releaseSecondFactorAttempts, reserveSecondFactorAttempt } from "../../_core/loginRateLimit";
import { verifyPlatformPassword } from "../../_core/platformPassword";
import { getPlatformSessionCookieOptions } from "../../_core/platformCookies";
import { FRIEND_ANSWER_MAX, FRIEND_ANSWER_MIN, hashSecurityAnswers, isValidPin, normalizeFriendAnswer, SECURITY_QUESTION, verifySecurityAnswers } from "../../_core/securityAnswers";
import { platformSecurityProcedure, router } from "../../_core/trpc";

// Tela "Segurança": cada admin cuida das PRÓPRIAS respostas (pergunta de segurança +
// código de 4 dígitos) e das PRÓPRIAS sessões. Usa platformSecurityProcedure (só
// exige sessão válida, sem área de permissão) — e funciona mesmo quando
// PLATFORM_REQUIRE_2FA=true barra o resto do painel pra quem ainda não cadastrou.
//
// Toda ação sensível pede a SENHA ATUAL (e as respostas atuais quando já cadastradas),
// e passa pelo mesmo rate limit rígido do login (5 tentativas/10min por conta): um
// cookie de sessão roubado sozinho não basta pra trocar as respostas do atacante
// (trancando o dono pra fora) nem pra desligar a verificação.

const passwordSchema = z.string().min(1).max(1024);
const friendSchema = z.string().trim().min(FRIEND_ANSWER_MIN, `A resposta precisa ter pelo menos ${FRIEND_ANSWER_MIN} letras.`).max(FRIEND_ANSWER_MAX);
const newPinSchema = z.string().trim().refine(isValidPin, "O código precisa ter exatamente 4 números.");
// Respostas ATUAIS (só conferidas, nunca gravadas): formato frouxo, o hash decide.
const currentAnswersSchema = z.object({ friendAnswer: z.string().trim().min(1).max(FRIEND_ANSWER_MAX), pin: z.string().trim().min(1).max(8) });

const BAD_CONFIRMATION_MESSAGE = "Senha, resposta ou código incorretos.";

async function loadOwnRecord(adminId: number) {
  const record = await getPlatformAdminSecurityRecord(adminId);
  if (!record || !record.active) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de administrador inválida ou expirada." });
  return record;
}

type SecurityRecord = Awaited<ReturnType<typeof loadOwnRecord>>;

/** Senha atual + (quando já há verificação cadastrada) as respostas atuais. Mensagem única: não diz qual falhou. */
async function assertPasswordAndCurrentAnswers(record: SecurityRecord, password: string, current: z.infer<typeof currentAnswersSchema> | undefined) {
  const passwordOk = await verifyPlatformPassword(password, record.passwordHash);
  const answersOk = record.securityEnabled
    ? Boolean(current) && (await verifySecurityAnswers({ friendHash: record.securityFriendHash, pinHash: record.securityPinHash }, current!.friendAnswer, current!.pin))
    : true;
  if (!passwordOk || !answersOk) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_CONFIRMATION_MESSAGE });
}

export const masterPanelSecurityRouter = router({
  status: platformSecurityProcedure.query(async ({ ctx }) => {
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    return { securityEnabled: record.securityEnabled, securityRequired: ENV.requirePlatform2fa, question: SECURITY_QUESTION };
  }),

  // Cadastra (ou troca) a resposta e o código. Só os HASHES vão pro banco. Quem acabou de
  // cadastrar ganha uma sessão nova, pra não ser deslogado pela revogação das antigas.
  setAnswers: platformSecurityProcedure
    .input(z.object({ password: passwordSchema, friendAnswer: friendSchema, pin: newPinSchema, current: currentAnswersSchema.optional() }))
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp(ctx.req);
      reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
      const record = await loadOwnRecord(ctx.platformAdmin.id);
      await assertPasswordAndCurrentAnswers(record, input.password, input.current);
      if (normalizeFriendAnswer(input.friendAnswer).length < FRIEND_ANSWER_MIN) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `A resposta precisa ter pelo menos ${FRIEND_ANSWER_MIN} letras.` });
      }

      await setPlatformAdminSecurityAnswers(record.id, await hashSecurityAnswers(input.friendAnswer, input.pin));
      releaseSecondFactorAttempts(record.id, ip);
      await issueSession(ctx, record.id, record.email);
      // Auditoria SEM as respostas — só o fato de que foram cadastradas/trocadas.
      await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: record.securityEnabled ? "admin.security_changed" : "admin.security_enabled", entityType: "platform_admin", entityId: record.id, ip });
      return { success: true } as const;
    }),

  disable: platformSecurityProcedure.input(z.object({ password: passwordSchema, current: currentAnswersSchema })).mutation(async ({ input, ctx }) => {
    if (ENV.requirePlatform2fa) {
      throw new TRPCError({ code: "FORBIDDEN", message: "A verificação de segurança é obrigatória neste painel e não pode ser desativada." });
    }
    const ip = getClientIp(ctx.req);
    reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    if (!record.securityEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "A verificação de segurança não está ativa." });
    await assertPasswordAndCurrentAnswers(record, input.password, input.current);

    await clearPlatformAdminSecurityAnswers(record.id);
    releaseSecondFactorAttempts(record.id, ip);
    // Desligar derruba as sessões (inclusive a atual); quem acabou de confirmar com senha + respostas ganha uma nova.
    await issueSession(ctx, record.id, record.email);
    await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: "admin.security_disabled", entityType: "platform_admin", entityId: record.id, ip });
    return { success: true } as const;
  }),

  // "Sair de todos os dispositivos": nenhuma sessão emitida até agora vale mais — inclusive esta (volta pra tela de login).
  revokeAllSessions: platformSecurityProcedure.mutation(async ({ ctx }) => {
    await revokeAllPlatformAdminSessions(ctx.platformAdmin.id);
    await recordPlatformAuditLog({ actorAdminId: ctx.platformAdmin.id, actorLabel: ctx.platformAdmin.email, action: "admin.sessions_revoked", entityType: "platform_admin", entityId: ctx.platformAdmin.id, ip: getClientIp(ctx.req) });
    ctx.res.clearCookie(ENV.platformSessionCookieName, { ...getPlatformSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
