import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { recordPlatformAuditLog } from "../../db/auditLog";
import {
  countUnusedRecoveryCodes,
  disablePlatformAdminTotp,
  enablePlatformAdminTotp,
  getPlatformAdminSecurityRecord,
  replacePlatformAdminRecoveryCodes,
  revokeAllPlatformAdminSessions,
  storePendingTotpSecret,
} from "../../db/platformAdminSecurity";
import { getClientIp } from "../../_core/clientIp";
import { ENV } from "../../_core/env";
import { issueSession } from "../../_core/issueSession";
import { releaseSecondFactorAttempts, reserveSecondFactorAttempt } from "../../_core/loginRateLimit";
import { verifyPlatformPassword } from "../../_core/platformPassword";
import { getPlatformSessionCookieOptions } from "../../_core/platformCookies";
import { verifySecondFactorCode } from "../../_core/secondFactor";
import { buildTotpQrCodeDataUrl, findMatchingTotpStep, generateTotpSecret } from "../../_core/totp";
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, hashRecoveryCode } from "../../_core/totpCrypto";
import { platformSecurityProcedure, router } from "../../_core/trpc";

// Tela "Segurança": cada admin cuida do PRÓPRIO 2FA e das PRÓPRIAS sessões.
// Usa platformSecurityProcedure (só exige sessão válida, sem área de
// permissão) — e funciona mesmo quando PLATFORM_REQUIRE_2FA=true barra o resto
// do painel pra quem ainda não ativou o 2FA.
//
// Toda ação sensível pede a SENHA ATUAL (e o código do 2FA quando já ativo),
// e passa pelo mesmo rate limit rígido do login (5 tentativas/10min por
// conta): um cookie de sessão roubado sozinho não basta pra ligar um 2FA do
// atacante (trancando o dono pra fora) nem pra desligar o 2FA.

const codeSchema = z.string().trim().min(1).max(32);
const passwordSchema = z.string().min(1).max(1024);

const BAD_CONFIRMATION_MESSAGE = "Senha ou código inválidos.";

async function loadOwnRecord(adminId: number) {
  const record = await getPlatformAdminSecurityRecord(adminId);
  if (!record || !record.active) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de administrador inválida ou expirada." });
  return record;
}

type SecurityRecord = Awaited<ReturnType<typeof loadOwnRecord>>;

async function assertCurrentPassword(record: SecurityRecord, password: string) {
  if (!(await verifyPlatformPassword(password, record.passwordHash))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
  }
}

/** Senha atual + (código do app OU código de recuperação). Devolve qual código valeu. */
async function assertPasswordAndSecondFactor(record: SecurityRecord, password: string, code: string) {
  await assertCurrentPassword(record, password);
  const kind = await verifySecondFactorCode(record, code);
  if (!kind) throw new TRPCError({ code: "UNAUTHORIZED", message: BAD_CONFIRMATION_MESSAGE });
  return kind;
}

function newRecoveryCodes() {
  const codes = generateRecoveryCodes();
  return { codes, hashes: codes.map(code => hashRecoveryCode(code)) };
}

export const masterPanelSecurityRouter = router({
  status: platformSecurityProcedure.query(async ({ ctx }) => {
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    return {
      totpEnabled: record.totpEnabled,
      setupPending: !record.totpEnabled && Boolean(record.totpSecret),
      recoveryCodesRemaining: record.totpEnabled ? await countUnusedRecoveryCodes(record.id) : 0,
      totpRequired: ENV.requirePlatform2fa,
    };
  }),

  // Passo 1 da ativação: gera o segredo (guardado CRIPTOGRAFADO, ainda desligado) e devolve o QR + a chave pra digitar à mão.
  startTotpSetup: platformSecurityProcedure.input(z.object({ password: passwordSchema })).mutation(async ({ input, ctx }) => {
    const ip = getClientIp(ctx.req);
    reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    if (record.totpEnabled) throw new TRPCError({ code: "CONFLICT", message: "A verificação em duas etapas já está ativa nesta conta." });
    await assertCurrentPassword(record, input.password);

    const secret = generateTotpSecret();
    if (!(await storePendingTotpSecret(record.id, encryptTotpSecret(secret)))) {
      throw new TRPCError({ code: "CONFLICT", message: "A verificação em duas etapas já está ativa nesta conta." });
    }
    releaseSecondFactorAttempts(record.id, ip);
    await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: "admin.totp_setup_started", entityType: "platform_admin", entityId: record.id, ip });
    return { qrCodeDataUrl: await buildTotpQrCodeDataUrl(record.email, secret), manualKey: secret };
  }),

  // Passo 2: confere o primeiro código, liga o 2FA e entrega os 10 códigos de recuperação (única vez em que aparecem).
  confirmTotpSetup: platformSecurityProcedure.input(z.object({ code: codeSchema })).mutation(async ({ input, ctx }) => {
    const ip = getClientIp(ctx.req);
    reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    if (record.totpEnabled) throw new TRPCError({ code: "CONFLICT", message: "A verificação em duas etapas já está ativa nesta conta." });
    if (!record.totpSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "Comece a ativação primeiro (botão Ativar)." });

    const step = findMatchingTotpStep(input.code, decryptTotpSecret(record.totpSecret), record.email);
    if (step === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Código incorreto. Confira o app autenticador e tente de novo." });

    const { codes, hashes } = newRecoveryCodes();
    // Ligar o 2FA derruba as sessões antigas (sessionsValidAfter, dentro da transação)...
    if (!(await enablePlatformAdminTotp(record.id, step, hashes))) {
      throw new TRPCError({ code: "CONFLICT", message: "A verificação em duas etapas já está ativa nesta conta." });
    }
    releaseSecondFactorAttempts(record.id, ip);
    // ...e quem acabou de ativar ganha uma sessão nova, pra não ser deslogado.
    await issueSession(ctx, record.id, record.email);
    await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: "admin.totp_enabled", entityType: "platform_admin", entityId: record.id, ip });
    return { recoveryCodes: codes };
  }),

  disableTotp: platformSecurityProcedure.input(z.object({ password: passwordSchema, code: codeSchema })).mutation(async ({ input, ctx }) => {
    if (ENV.requirePlatform2fa) {
      throw new TRPCError({ code: "FORBIDDEN", message: "A verificação em duas etapas é obrigatória neste painel e não pode ser desativada." });
    }
    const ip = getClientIp(ctx.req);
    reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    if (!record.totpEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "A verificação em duas etapas não está ativa." });
    const kind = await assertPasswordAndSecondFactor(record, input.password, input.code);

    await disablePlatformAdminTotp(record.id);
    releaseSecondFactorAttempts(record.id, ip);
    // Desligar derruba as sessões (inclusive a atual); quem acabou de confirmar com senha+código ganha uma nova.
    await issueSession(ctx, record.id, record.email);
    await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: "admin.totp_disabled", entityType: "platform_admin", entityId: record.id, after: { confirmadoCom: kind }, ip });
    return { success: true } as const;
  }),

  regenerateRecoveryCodes: platformSecurityProcedure.input(z.object({ password: passwordSchema, code: codeSchema })).mutation(async ({ input, ctx }) => {
    const ip = getClientIp(ctx.req);
    reserveSecondFactorAttempt(ctx.platformAdmin.id, ip);
    const record = await loadOwnRecord(ctx.platformAdmin.id);
    if (!record.totpEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Ative a verificação em duas etapas primeiro." });
    const kind = await assertPasswordAndSecondFactor(record, input.password, input.code);

    const { codes, hashes } = newRecoveryCodes();
    await replacePlatformAdminRecoveryCodes(record.id, hashes);
    releaseSecondFactorAttempts(record.id, ip);
    await recordPlatformAuditLog({ actorAdminId: record.id, actorLabel: record.email, action: "admin.recovery_codes_regenerated", entityType: "platform_admin", entityId: record.id, after: { confirmadoCom: kind }, ip });
    return { recoveryCodes: codes };
  }),

  // "Sair de todos os dispositivos": nenhuma sessão emitida até agora vale mais — inclusive esta (volta pra tela de login).
  revokeAllSessions: platformSecurityProcedure.mutation(async ({ ctx }) => {
    await revokeAllPlatformAdminSessions(ctx.platformAdmin.id);
    await recordPlatformAuditLog({ actorAdminId: ctx.platformAdmin.id, actorLabel: ctx.platformAdmin.email, action: "admin.sessions_revoked", entityType: "platform_admin", entityId: ctx.platformAdmin.id, ip: getClientIp(ctx.req) });
    ctx.res.clearCookie(ENV.platformSessionCookieName, { ...getPlatformSessionCookieOptions(ctx.req), maxAge: -1 });
    return { success: true } as const;
  }),
});
