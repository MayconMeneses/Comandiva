/**
 * Rolagem nativa do navegador (a mais leve). A rolagem suave com Lenis foi
 * removida em 2026-10-14: ela lia a posição da página a cada quadro e
 * forçava recálculo de layout, deixando a rolagem pesada.
 */
export function scrollToTarget(target: number | string, immediate = false) {
  const behavior: ScrollBehavior = immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  if (typeof target === "number") window.scrollTo({ top: target, behavior });
  else document.querySelector(target)?.scrollIntoView({ behavior });
}
