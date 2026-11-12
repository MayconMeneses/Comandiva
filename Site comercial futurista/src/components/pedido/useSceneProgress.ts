import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { scrollToTarget } from "../../lib/scroll";
import { FRAMES } from "../../data/pedido";

/** Início (progresso 0 a 1) de cada beat. O quadro 5 tem dois beats (aceito, em produção). */
const N = FRAMES.length;
const BEATS = [0, 1 / N, 2 / N, 3 / N, 4 / N, 4.5 / N, 5 / N, 6 / N];

function beatAt(p: number) {
  let b = 0;
  BEATS.forEach((start, i) => {
    if (p >= start - 1e-6) b = i;
  });
  return b;
}

/**
 * Progresso único da cena (0 a 1) vindo da rolagem. Só o "beat" vira estado
 * React (muda poucas vezes); cursor, carrinho e entrada do celular leem os
 * MotionValues direto, sem re-render.
 */
export function useSceneProgress() {
  const ref = useRef<HTMLElement>(null);
  const [beat, setBeat] = useState(0);
  const { scrollYProgress: progress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const { scrollYProgress: enter } = useScroll({ target: ref, offset: ["start end", "start start"] });

  useMotionValueEvent(progress, "change", p => setBeat(s => (beatAt(p) === s ? s : beatAt(p))));
  useEffect(() => setBeat(beatAt(progress.get())), [progress]);

  function goToFrame(i: number) {
    const el = ref.current;
    if (!el) return;
    const range = el.offsetHeight - window.innerHeight;
    const top = el.getBoundingClientRect().top + window.scrollY;
    scrollToTarget(top + range * ((i + 0.2) / N));
  }

  return { ref, progress, enter, beat, goToFrame };
}
