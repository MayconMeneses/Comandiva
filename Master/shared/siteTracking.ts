// Contrato da medição própria do site comercial (cliente e servidor).
// Sem campos livres: só evento do enum + caminho /comercial sem query string.

export const SITE_TRACK_EVENTS = ["page_view", "cta_click", "signup_start", "signup_step", "signup_submit", "signup_success"] as const;
export type SiteTrackEvent = (typeof SITE_TRACK_EVENTS)[number];

export const SITE_TRACK_PATH_MAX = 120;
const SITE_TRACK_PATH_PATTERN = /^\/comercial(\/[A-Za-z0-9_-]+)*$/;

export function isValidSiteTrackPath(path: unknown): path is string {
  return typeof path === "string" && path.length <= SITE_TRACK_PATH_MAX && SITE_TRACK_PATH_PATTERN.test(path);
}

const BOT_PATTERN = /bot|crawler|spider|headless/i;
export function isBotUserAgent(userAgent: string | undefined): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/** Dia 'YYYY-MM-DD' no fuso de Fortaleza (sem horário de verão). */
export function fortalezaDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
