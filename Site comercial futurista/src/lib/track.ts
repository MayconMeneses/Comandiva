import { publicPath } from "./seo";

/** Mesmos eventos aceitos pelo servidor do Master (shared/siteTracking.ts). */
export type SiteTrackEvent = "page_view" | "cta_click" | "signup_start" | "signup_step" | "signup_submit" | "signup_success";

/**
 * Medição própria e anônima, igual à do site atual: sem cookie, sem ID,
 * sem terceiro, respeita "Do Not Track" e nunca quebra a página. Envia o
 * caminho público (/comercial/...) para o endpoint do Master.
 *
 * Só liga quando VITE_TRACK_ENDPOINT estiver definido (ex.: "/api/track"
 * no build publicado junto do Master). Rodando sozinho, não envia nada —
 * assim não aparece 404 na aba Rede.
 */
const ENDPOINT = import.meta.env.VITE_TRACK_ENDPOINT as string | undefined;

export function track(event: SiteTrackEvent, route = window.location.pathname) {
  try {
    if (!ENDPOINT || navigator.doNotTrack === "1") return;
    const body = JSON.stringify({ event, path: publicPath(route) });
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // medição nunca pode quebrar a página
  }
}
