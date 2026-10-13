import type { SiteTrackEvent } from "@shared/siteTracking";

/**
 * Medição própria e anônima do site comercial (ver server/_core/siteTrack.ts):
 * sem cookie, sem ID, sem terceiro. Silenciosa em qualquer falha e respeita
 * "Do Not Track". O caminho enviado é sempre o pathname atual, sem query.
 */
export function track(event: SiteTrackEvent) {
  try {
    if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
    const path = window.location.pathname;
    if (!path.startsWith("/comercial")) return;
    const body = JSON.stringify({ event, path });
    const blob = new Blob([body], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/track", blob)) return;
    void fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // medição nunca pode quebrar a página
  }
}
