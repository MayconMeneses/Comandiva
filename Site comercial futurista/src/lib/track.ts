import { publicPath } from "./seo";

/** Mesmos eventos aceitos pelo servidor do Master (shared/siteTracking.ts). */
export type SiteTrackEvent = "page_view" | "cta_click" | "signup_start" | "signup_step" | "signup_submit" | "signup_success";

/**
 * Medição própria e anônima, igual à do site atual: sem cookie, sem ID,
 * sem terceiro, respeita "Do Not Track" e nunca quebra a página. Envia o
 * caminho público (/comercial/...) para o endpoint do Master.
 *
 * Liga no build de produção (/api/track no Master) e nunca em localhost.
 * Rodando sozinho, não envia nada —
 * assim não aparece 404 na aba Rede.
 */
// Endpoint do Master (mesmo do site atual). Só no build de produção; VITE_TRACK_ENDPOINT permite trocar.
const ENDPOINT = (import.meta.env.VITE_TRACK_ENDPOINT as string | undefined) ?? (import.meta.env.PROD ? "/api/track" : undefined);

/** Rota interna atual ("/planos"), sem a base /comercial do site. */
const currentRoute = () => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const p = window.location.pathname;
  return p.startsWith(base) ? p.slice(base.length) || "/" : p;
};

export function track(event: SiteTrackEvent, route = currentRoute()) {
  try {
    if (!ENDPOINT || navigator.doNotTrack === "1") return;
    // Testes no computador (o Vite repassa /api para a produção) não contam como visita real.
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
    const body = JSON.stringify({ event, path: publicPath(route) });
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // medição nunca pode quebrar a página
  }
}
