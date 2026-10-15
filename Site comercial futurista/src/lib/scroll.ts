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

/**
 * Rola até uma âncora (#id) assim que ela existir. As seções de baixo da Home
 * carregam sob demanda (lazy), então logo depois de abrir a página, de voltar
 * de outra rota ou de abrir um link com "#" o alvo pode ainda não estar na
 * tela — rolar na hora não fazia nada. Tenta a cada quadro por até 6 s.
 */
export function scrollToHashWhenReady(hash: string, timeoutMs = 6000) {
  const start = performance.now();
  const tick = () => {
    let found: Element | null = null;
    try {
      found = document.querySelector(hash);
    } catch {
      return; // "#" inválido: nada a fazer
    }
    if (found) {
      scrollToTarget(hash);
      return;
    }
    if (performance.now() - start < timeoutMs) requestAnimationFrame(tick);
  };
  tick();
}
