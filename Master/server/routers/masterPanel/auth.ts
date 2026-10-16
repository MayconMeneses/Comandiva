import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticatePlatformAdmin, markPlatformAdminSignedIn } from "../../db/platformAdmins";
import { getPlatformAdminSecurityRecord } from "../../db/platformAdminSecurity";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { getClientIp } from "../../_core/clientIp";
import { getPlatformSessionCookieOptions } from "../../_core/platformCookies";
import { issueSession } from "../../_core/issueSession";
import { isSessionRevoked, signPendingSecurityToken, verifyPendingSecurityToken } from "../../_core/platformSession";
import {
  clearLoginAttempts,
  recordEmailFailure,
  refundLoginIpAttempt,
  releaseSecondFactorAttempts,
  reserveLoginAttempt,
  reserveSecondFactorAttempt,
  shouldAuditLoginFailure,
} from "../../_core/loginRateLimit";
import { FRIEND_ANSWER_MAX, verifySecurityAnswers } from "../../_core/securityAnswers";
import { buildLoginFailuresMessage, buildMasterLoginMessage, sendTelegramMessageAsync } from "../../_core/telegramService";
import { ENV } from "../../_core/env";
import { publicProcedure, router } from "../../_core/trpc";
import type { TrpcContext } from "../../_core/context";

// Mensagem única pra qualquer falha de senha (e-mail inexistente, conta
// pausada, senha errada) — não revela quais e-mails existem.
const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos.";
const LOGIN_EXPIRED_MESSAGE = "Sua tentativa de login expirou. Digite e-mail e senha de novo.";

/** Fecha o login (depois de senha E, se houver, pergunta + código): sessão, auditoria e alerta no Telegram a cada entrada. */
async function finishLogin(ctx: TrpcContext, admin: { id: number; name: string; email: string }, how: { usedSecurityQuestions: boolean }) {
  const ip = getClientIp(ctx.req);
  await markPlatformAdminSignedIn(admin.id);
  await issueSession(ctx, admin.id, admin.email);
  await recordPlatformAuditLog({
    actorAdminId: admin.id,
    actorLabel: admin.email,
    action: "admin.login_success",
    after: { metodo: how.usedSecurityQuestions ? "senha+pergunta_e_codigo" : "senha" },
    ip,
  });
  const userAgent = ctx.req.headers?.["user-agent"];
  sendTelegramMessageAsync(
    buildMasterLoginMessage({ email: admin.email, ip, userAgent: typeof userAgent === "string" ? userAgent : undefined, usedSecurityQuestions: how.usedSecurityQuestions }),
  );
}

async function handleLoginFailure(ip: string, email: string, knownAdmin: { id: number; email: string } | null) {
  const { failures, shouldAlert } = recordEmailFailure(email);
  if (shouldAlert) sendTelegramMessageAsync(buildLoginFailuresMessage({ email, failures, ip }));
  if (shouldAuditLoginFailure(ip, email)) {
    await recordPlatformAuditLog({
      actorAdminId: knownAdmin?.id ?? null,
      // E-mail inexistente: "desconhecido", pra audit_log (append-only) não guardar texto arbitrário digitado por qualquer um.
      actorLabel: knownAdmin?.email ?? "desconhecido",
      action: "admin.login_failed",
      after: { motivo: "credenciais inválidas" },
      ip,
    });
  }
}

export const masterPanelAuthRouter = router({
  // Nunca devolve hash/segredo (getPlatformAdminById já tira) nem o marco interno de sessão.
  me: publicProcedure.query(({ ctx }) => {
    const admin = ctx.platformAdmin;
    if (!admin?.active) return null;
    // Segunda barreira: o contexto já vem sem segredos (stripAllSecrets), mas hash de resposta nunca sai daqui.
    const { sessionsValidAfter, securityFriendHash, securityPinHash, ...publicAdmin } = admin as typeof admin & { securityFriendHash?: unknown; securityPinHash?: unknown };
    void [sessionsValidAfter, securityFriendHash, securityPinHash];
    return { ...publicAdmin, mustSetupSecurity: ENV.requirePlatform2fa && !admin.securityEnabled };
  }),

  // Passo 1: e-mail + senha. Conta SEM verificação cadastrada já entra aqui. Conta COM
  // verificação recebe só um token pendente de 5 min (não vale como sessão) e precisa
  // de verifySecurity (pergunta de segurança + código de 4 dígitos).
  login: publicProcedure
    .input(z.object({ email: z.string().trim().max(320).email(), password: z.string().min(1).max(1024) }))
    .mutation(async ({ input, ctx }) => {
      const email = input.email.trim().toLowerCase();
      const ip = getClientIp(ctx.req);
      reserveLoginAttempt(ip, email);

      const result = await authenticatePlatformAdmin(email, input.password);
      if (!result.ok) {
        await handleLoginFailure(ip, email, result.knownAdmin);
        throw new TRPCError({ code: "UNAUTHORIZED", message: INVALID_CREDENTIALS_MESSAGE });
      }
      const admin = result.admin;
      // Senha certa não gasta o limite por IP (ele serve pra quem erra).
      refundLoginIpAttempt(ip);

      if (admin.securityEnabled) {
        // Contadores NÃO são limpos aqui: só quando o fluxo inteiro (senha + respostas) termina bem.
        return { requiresSecurity: true as const, pendingToken: await signPendingSecurityToken(admin.id, admin.email) };
      }

      clearLoginAttempts(ip, email);
      await finishLogin(ctx, admin, { usedSecurityQuestions: false });
      return { requiresSecurity: false as const, name: admin.name, email: admin.email };
    }),

  // Passo 2: pergunta de segurança (melhor amigo de infância) + código de 4 dígitos.
  verifySecurity: publicProcedure
    .input(z.object({ pendingToken: z.string().min(1).max(2048), friendAnswer: z.string().trim().min(1).max(FRIEND_ANSWER_MAX), pin: z.string().trim().min(1).max(8) }))
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp(ctx.req);
      const pending = await verifyPendingSecurityToken(input.pendingToken);
      if (!pending) throw new TRPCError({ code: "UNAUTHORIZED", message: LOGIN_EXPIRED_MESSAGE });

      // Cada chamada gasta uma tentativa ANTES de olhar as respostas (5 por conta a cada 10 min).
      reserveSecondFactorAttempt(pending.adminId, ip);

      const admin = await getPlatformAdminSecurityRecord(pending.adminId);
      // Senha trocada / conta pausada / verificação mudou depois do passo 1: o token pendente não vale mais.
      if (!admin || !admin.active || !admin.securityEnabled || isSessionRevoked(pending.iat, admin.sessionsValidAfter)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: LOGIN_EXPIRED_MESSAGE });
      }

      const ok = await verifySecurityAnswers({ friendHash: admin.securityFriendHash, pinHash: admin.securityPinHash }, input.friendAnswer, input.pin);
      if (!ok) {
        await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.security_failed", after: { motivo: "resposta inválida" }, ip });
        // Mensagem única: não diz se errou o nome ou o código.
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Resposta ou código incorretos." });
      }

      // Fluxo completo: agora sim zera os contadores.
      releaseSecondFactorAttempts(admin.id, ip);
      clearLoginAttempts(ip, admin.email);

      await finishLogin(ctx, admin, { usedSecurityQuestions: true });
      return { requiresSecurity: false as const, name: admin.name, email: admin.email };
    }),

  // Logout normal só limpa o cookie neste navegador (derrubar TODAS as sessões é "Sair de todos os dispositivos", na tela Segurança).
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.platformAdmin) {
      await recordPlatformAuditLog({ actorAdminId: ctx.platformAdmin.id, actorLabel: ctx.platformAdmin.email, action: "admin.logout", ip: getClientIp(ctx.req) });
    }
    ctx.res.clearCookie(ENV.platformSessionCookieName, { ...getPlatformSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
