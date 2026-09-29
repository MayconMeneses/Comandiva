import { useEffect, useRef, useState } from "react";

/**
 * Marca um elemento como "visível" na primeira vez que ele entra na tela
 * (nunca desfaz depois — não é pra "piscar" de novo ao rolar pra cima e
 * voltar, só uma entrada suave na primeira vez). Usado no site comercial
 * pra dar um pouco de movimento real às seções, em vez de tudo aparecer
 * estático de uma vez — sem trazer nenhuma biblioteca nova (Intersection
 * Observer já é nativo do navegador).
 *
 * Respeita `prefers-reduced-motion`: quem pediu isso no sistema operacional
 * já entra com `visible=true` direto, sem nunca animar — o consumidor deste
 * hook só precisa condicionar a classe de animação ao valor devolvido, sem
 * checar a media query ele mesmo.
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
