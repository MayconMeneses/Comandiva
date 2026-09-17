import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import { z } from "zod";
import {
  authenticatePlatformAdmin,
  enablePlatformAdminTotp,
  getPlatformAdminById,
  getPlatformAdminTotpSecretById,
  setPlatformAdminTotpSecret,
} from "../../db/platformAdmins";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { TRUSTED_DEVICE_COOKIE_NAME, getPlatformSessionCookieOptions, getTrustedDeviceCookieOptions } from "../../_core/platformCookies";
import {
  createPlatformSessionToken,
  createTrustedDeviceToken,
  getTrustedDeviceCookieMaxAgeMs,
  isTrustedDeviceForAdmin,
  signPendingTotpToken,
  verifyPendingTotpToken,
} from "../../_core/platformSession";
import { buildTotpQrCodeDataUrl, generateTotpSecret, verifyTotpToken } from "../../_core/totp";
import { checkRateLimit, clearRateLimit } from "../../_core/rateLimit";
import { ENV } from "../../_core/env";
import { publicProcedure, router } from "../../_core/trpc";
import type { TrpcContext } from "../../_core/context";

async function issueSessionAndTrustDevice(ctx: TrpcContext, adminId: number, email: string) {
  const sessionToken = await createPlatformSessionToken(adminId, email);
  ctx.res.cookie(ENV.platformSessionCookieName, sessionToken, getPlatformSessionCookieOptions(ctx.req));
  const trustedDeviceToken = await createTrustedDeviceToken(adminId);
  ctx.res.cookie(TRUSTED_DEVICE_COOKIE_NAME, trustedDeviceToken, getTrustedDeviceCookieOptions(ctx.req, getTrustedDeviceCookieMaxAgeMs()));
}

export const masterPanelAuthRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.platformAdmin),

  login: publicProcedure
    .input(z.object({ email: z.string().trim().email(), password: z.string().min(1), totpToken: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
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

      if (admin.totpEnabled) {
        const cookies = parseCookieHeader(ctx.req.headers.cookie ?? "");
        const trusted = await isTrustedDeviceForAdmin(cookies[TRUSTED_DEVICE_COOKIE_NAME], admin.id);

        if (!trusted && !input.totpToken) {
          const pendingToken = await signPendingTotpToken({ purpose: "totp-verify", adminId: admin.id, email: admin.email });
          return { requiresTotpToken: true as const, pendingToken };
        }

        if (!trusted && !verifyTotpToken(input.totpToken!, admin.totpSecret ?? "", admin.email)) {
          await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.login_failed", ip: ctx.req.ip });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Código de autenticação inválido." });
        }
      } else {
        // 2FA ainda não configurado nesta conta — pede pra configurar antes
        // de liberar a sessão (rollout gradual, mesma ideia de MMSystemCreator:
        // continua exigindo em toda tentativa até a conta confirmar o setup).
        const secret = generateTotpSecret();
        await setPlatformAdminTotpSecret(admin.id, secret);
        const qrCodeDataUrl = await buildTotpQrCodeDataUrl(admin.email, secret);
        const pendingToken = await signPendingTotpToken({ purpose: "totp-setup", adminId: admin.id, email: admin.email });
        return { requiresTotpSetup: true as const, qrCodeDataUrl, pendingToken };
      }

      // Só limpa o rate limit quando TODO o fluxo (senha + 2FA, quando exigido)
      // terminou com sucesso — limpar logo depois da senha deixaria o código
      // de 6 dígitos sem limite de tentativas (mesmo cuidado já aplicado no
      // app principal desta plataforma).
      clearRateLimit(rateLimitKey);
      await issueSessionAndTrustDevice(ctx, admin.id, admin.email);
      await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.login_success", ip: ctx.req.ip });
      return { name: admin.name, email: admin.email };
    }),

  confirmTotpSetup: publicProcedure
    .input(z.object({ pendingToken: z.string(), code: z.string().min(6).max(6) }))
    .mutation(async ({ input, ctx }) => {
      const pending = await verifyPendingTotpToken(input.pendingToken);
      if (!pending || pending.purpose !== "totp-setup") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Sessão de configuração de 2FA expirada. Faça login novamente." });
      }

      // Mesmo cuidado do login: sem rate limit aqui, um pendingToken válido
      // (só se obtém sabendo a senha certa) permitiria força bruta ilimitada
      // do código de 6 dígitos pelos 10 minutos de validade do token.
      const rateLimitKey = `platform-totp-setup:${ctx.req.ip}:${pending.adminId}`;
      const limit = checkRateLimit(rateLimitKey);
      if (!limit.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
      }

      const admin = await getPlatformAdminById(pending.adminId);
      const totpSecret = await getPlatformAdminTotpSecretById(pending.adminId);
      if (!admin || !totpSecret || !verifyTotpToken(input.code, totpSecret, admin.email)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido." });
      }
      clearRateLimit(rateLimitKey);

      await enablePlatformAdminTotp(admin.id);
      await issueSessionAndTrustDevice(ctx, admin.id, admin.email);
      await recordPlatformAuditLog({ actorAdminId: admin.id, actorLabel: admin.email, action: "admin.totp_enabled", ip: ctx.req.ip });
      return { name: admin.name, email: admin.email };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.platformAdmin) {
      await recordPlatformAuditLog({ actorAdminId: ctx.platformAdmin.id, actorLabel: ctx.platformAdmin.email, action: "admin.logout", ip: ctx.req.ip });
    }
    ctx.res.clearCookie(ENV.platformSessionCookieName, { ...getPlatformSessionCookieOptions(ctx.req), maxAge: -1 });
    // Não limpa o cookie de dispositivo confiável no logout — ele marca o
    // NAVEGADOR, não a sessão; continuar confiável evita pedir o código de
    // novo no próximo login do mesmo dispositivo (é exatamente o ponto).
    return { success: true } as const;
  }),
});
