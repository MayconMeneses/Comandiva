export const COOKIE_NAME = "app_session_id";
// Sessão do Modo Suporte — cookie próprio, nunca confundido com o de login
// real (COOKIE_NAME acima). Ver server/_core/supportSession.ts.
export const SUPPORT_COOKIE_NAME = "support_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Duração do login do app (equipe/admin do restaurante): 30 dias (auditoria 2026-10-10, antes 1 ano).
// Trocar a senha ou pausar a conta derruba o login na hora (sessionsValidAfter), independente deste prazo.
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
