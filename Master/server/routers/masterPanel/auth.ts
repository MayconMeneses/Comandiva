import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticatePlatformAdmin, markPlatformAdminSignedIn } from "../../db/platformAdmins";
import { countUnusedRecoveryCodes, getPlatformAdminSecurityRecord } from "../../db/platformAdminSecurity";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { getClientIp } from "../../_core/clientIp";
import { getPlatformSessionCookieOptions } from "../../_core/platformCookies";
import { issueSession } from "../../_core/issueSession";
import { isSessionRevoked, signPendingTotpToken, verifyPendingTotpToken } from "../../_core/platformSession";
import {
  clearLoginAttempts,
  recordEmailFailure,
  refundLoginIpAttempt,
  releaseSecondFactorAttempts,
  reserveLoginAttempt,
  reserveSecondFactorAttempt,
  shouldAuditLoginFailure,
} from "../../_core/loginRateLimit";
import { verifySecondFactorCode } from "../../_core/secondFactor";
import { buildLoginFailuresMessage, buildMasterLoginMessage, sendTelegramMessageAsync } from "../../_core/telegramService";
import { ENV } from "../../_core/env";
import { publicProcedure, router } from "../../_core/trpc";
import type { TrpcContext } from "../../_core/context";

// Mensagem única pra qualquer falha de senha (e-mail inexistente, conta
// pausada, senha errada) — não revela quais e-mails existem.
const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos.";
const LOGIN_EXPIRED_MESSAGE = "Sua tentativa de login expirou. Digite e-mail e senha de novo.";
// Avisar quando sobram poucos códigos de recuperação (a tela Segurança mostra o aviso).
const LOW_RECOVERY_CODES_THRESHOLD = 2;

/** Fecha o login (depois de senha E, se houver, código): sessão, auditoria e alerta no Telegram a cada entrada. */
async function finishLogin(ctx: TrpcContext, admin: { id: number; name: string; email: string }, how: { used2fa: boolean; usedRecoveryCode: boolean }) {
  const ip = getClientIp(ctx.req);
  await markPlatformAdminSignedIn(admin.id);
  await issueSession(ctx, admin.id, admin.email);
  await recordPlatformAuditLog({
    actorAdminId: admin.id,
    actorLabel: admin.email,
    action: "admin.login_success",
    after: { metodo: how.usedRecoveryCode ? "senha+codigo_de_recuperacao" : how.used2fa ? "senha+totp" : "senha" },
    ip,
  });
  const userAgent = ctx.req.headers?.["user-agent"];
  sendTelegramMessageAsync(
    buildMasterLoginMessage({ email: admin.email, ip, userAgent: typeof userAgent === "string" ? userAgent : undefined, used2fa: how.used2fa, usedRecoveryCode: how.usedRecoveryCode }),
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
    const { sessionsValidAfter, ...publicAdmin } = admin;
    void sessionsValidAfter;
    return { ...publicAdmin, mustSetupTotp: ENV.requirePlatform2fa && !admin.totpEnabled };
  }),

  // Passo 1: e-mail + senha. Conta SEM 2FA já entra aqui. Conta COM 2FA recebe
  // só um token pendente de 5 min (não vale como sessão) e precisa de verifyTotp.
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

      if (admin.totpEnabled) {
        // Contadores NÃO são limpos aqui: só quando o fluxo inteiro (senha + código) termina bem.
        return { requiresTotp: true as const, pendingToken: await signPendingTotpToken(admin.id, admin.email) };
      }

      clearLoginAttempts(ip, email);
      await finishLogin(ctx, admin, { used2fa: false, usedRecoveryCode: false });
      return { requiresTotp: false as const, name: admin.name, email: admin.email, usedRecoveryCode: false, recoveryCodesRemaining: null };
    }),

  // Passo 2: código de 6 dígitos do app OU código de recuperação.
  verifyTotp: publicProcedure
    .input(z.object({ pendingToken: z.string().min(1).max(2048), code: z.string().trim().min(1).max(32) }))
    .mutation(async ({ input, ctx }) => {
      const ip = getClientIp(ctx.req);
      const pending = await verifyPendingTotpToken(input.pendingToken);
      if (!pending) throw new TRPCError({ code: "UNAUTHORIZED", message: LOGIN_EXPIRED_MESSAGE });

      // Cada chamada gasta uma tentativa ANTES de olhar o código.
      reserveSecondFactorAttempt(pending.adminId, ip);

      const admin = await getPlatformAdminSecurityRecord(pending.adminId);
      // Senha trocada / conta pausada / 2FA mudou depois do passo 1: o token pendente não vale mais.
      if (!admin || !admin.active || !admin.totpEnabled || isSessionRevoked(pending.iat, admin.sessionsValidAfter)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: LOGIN_EXPIRED_MESSAGE });
      }

      const kind = await verifySecondFactorCode(admin, input.code);
      if (!kind) {
        await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.totp_failed", after: { motivo: "código inválido" }, ip });
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou já usado. Confira o app autenticador e tente de novo." });
      }

      // Fluxo completo: agora sim zera os contadores.
      releaseSecondFactorAttempts(admin.id, ip);
      clearLoginAttempts(ip, admin.email);

      const usedRecoveryCode = kind === "recovery";
      let recoveryCodesRemaining: number | null = null;
      if (usedRecoveryCode) {
        recoveryCodesRemaining = await countUnusedRecoveryCodes(admin.id);
        await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.recovery_code_used", after: { restantes: recoveryCodesRemaining }, ip });
      }
      await finishLogin(ctx, admin, { used2fa: true, usedRecoveryCode });
      return {
        requiresTotp: false as const,
        name: admin.name,
        email: admin.email,
        usedRecoveryCode,
        // Só informado quando faltam poucos — o front manda pra tela Segurança com o aviso.
        recoveryCodesRemaining: recoveryCodesRemaining !== null && recoveryCodesRemaining <= LOW_RECOVERY_CODES_THRESHOLD ? recoveryCodesRemaining : null,
      };
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
