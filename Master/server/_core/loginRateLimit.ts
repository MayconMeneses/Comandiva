import { TRPCError } from "@trpc/server";
import { checkRateLimit, clearRateLimit, incrementCounter, refundRateLimit } from "./rateLimit";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function tooManyAttempts(retryAfterSeconds: number | undefined): never {
  throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas. Tente novamente em ${Math.ceil((retryAfterSeconds ?? 60) / 60)} minuto(s).` });
}

// ---------- Passo 1: e-mail + senha ----------
// Dois limites, ambos POR IP:
//  - 5 tentativas/15min por IP+e-mail (força bruta numa conta);
//  - 15/hora por IP sozinho (quem troca o e-mail a cada tentativa não escapa do limite acima).
// De propósito NÃO existe bloqueio por e-mail sozinho: qualquer pessoa na
// internet poderia "gastar" o limite do e-mail do dono e trancá-lo pra fora.
// Por e-mail só há ALERTA (recordEmailFailure), que nunca bloqueia.
const LOGIN_IP_EMAIL = { windowMs: 15 * MINUTE, maxAttempts: 5 };
const LOGIN_IP = { windowMs: HOUR, maxAttempts: 15 };
const EMAIL_FAILURE_ALERT_EVERY = 10;

const ipEmailKey = (ip: string, email: string) => `platform-login:${ip}:${email}`;
const ipKey = (ip: string) => `platform-login-ip:${ip}`;

/** Reserva uma tentativa (a contagem é feita ANTES do scrypt, pra requisições paralelas não furarem o limite). Lança 429 se estourou. */
export function reserveLoginAttempt(ip: string, email: string): void {
  const byIpEmail = checkRateLimit(ipEmailKey(ip, email), LOGIN_IP_EMAIL);
  if (!byIpEmail.allowed) tooManyAttempts(byIpEmail.retryAfterSeconds);
  const byIp = checkRateLimit(ipKey(ip), LOGIN_IP);
  if (!byIp.allowed) {
    refundRateLimit(ipEmailKey(ip, email));
    tooManyAttempts(byIp.retryAfterSeconds);
  }
}

/** Senha certa: o contador por IP vira "só falhas" (quem acerta não gasta o limite horário). */
export function refundLoginIpAttempt(ip: string): void {
  refundRateLimit(ipKey(ip));
}

/** Login COMPLETO (senha + código, se houver): zera o contador IP+e-mail. */
export function clearLoginAttempts(ip: string, email: string): void {
  clearRateLimit(ipEmailKey(ip, email));
}

/** Conta falhas por e-mail na última hora (nunca bloqueia). Devolve true quando é hora de alertar (a cada 10 falhas). */
export function recordEmailFailure(email: string): { failures: number; shouldAlert: boolean } {
  const failures = incrementCounter(`platform-login-email-failures:${email}`, HOUR);
  return { failures, shouldAlert: failures % EMAIL_FAILURE_ALERT_EVERY === 0 };
}

/** Só 1 linha de login_failed no audit por IP+e-mail a cada 15min — a tabela é append-only, não pode virar depósito de e-mails arbitrários. */
export function shouldAuditLoginFailure(ip: string, email: string): boolean {
  return checkRateLimit(`platform-login-audit:${ip}:${email}`, { windowMs: LOGIN_IP_EMAIL.windowMs, maxAttempts: 1 }).allowed;
}

// ---------- Passo 2: código do 2FA (e confirmações sensíveis da tela Segurança) ----------
// Mais rígido que a senha: 5 tentativas/10min POR CONTA (chave = adminId, não
// só IP — trocar de IP não ajuda) + 20/hora por IP. Quem acertou a senha e
// erra o código só consegue 5 chutes por janela (código de 6 dígitos).
const SECOND_FACTOR_ADMIN = { windowMs: 10 * MINUTE, maxAttempts: 5 };
const SECOND_FACTOR_IP = { windowMs: HOUR, maxAttempts: 20 };

const secondFactorAdminKey = (adminId: number) => `platform-2fa:admin:${adminId}`;
const secondFactorIpKey = (ip: string) => `platform-2fa:ip:${ip}`;

export function reserveSecondFactorAttempt(adminId: number, ip: string): void {
  const byAdmin = checkRateLimit(secondFactorAdminKey(adminId), SECOND_FACTOR_ADMIN);
  if (!byAdmin.allowed) tooManyAttempts(byAdmin.retryAfterSeconds);
  const byIp = checkRateLimit(secondFactorIpKey(ip), SECOND_FACTOR_IP);
  if (!byIp.allowed) {
    refundRateLimit(secondFactorAdminKey(adminId));
    tooManyAttempts(byIp.retryAfterSeconds);
  }
}

/** Só chamar quando o fluxo INTEIRO deu certo — zera o contador da conta e devolve a tentativa ao IP. */
export function releaseSecondFactorAttempts(adminId: number, ip: string): void {
  clearRateLimit(secondFactorAdminKey(adminId));
  refundRateLimit(secondFactorIpKey(ip));
}
