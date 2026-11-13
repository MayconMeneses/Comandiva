import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocation } from "wouter";
import { ENTRY_PRICE_BRL } from "../data/pricing";
import { track } from "../lib/track";
import { asset } from "../lib/asset";

/** Fim da página: o CTA final ou, se ainda não carregou, o rodapé. */
const END_SELECTORS = ['[aria-labelledby="cta-title"]', "footer"];

/**
 * Barra inferior só no celular (até 768px): aparece depois que o hero sai da tela e some
 * quando o CTA final ou o rodapé entram. Com "reduzir movimento" só aparece, sem deslizar.
 */
export function StickyCta({ heroRef }: { heroRef: RefObject<HTMLElement | null> }) {
  const [show, setShow] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [, navigate] = useLocation();

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)");
    let frame = 0;
    const check = () => {
      frame = 0;
      const hero = heroRef.current;
      const past = !!hero && hero.getBoundingClientRect().bottom < 0;
      const atEnd = END_SELECTORS.some(sel => {
        const el = document.querySelector(sel);
        return !!el && el.getBoundingClientRect().top < window.innerHeight;
      });
      setShow(mobile.matches && past && !atEnd);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // O CTA final chega num pedaço carregado depois: reavalia quando a página cresce.
    const grow = new ResizeObserver(schedule);
    grow.observe(document.body);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      grow.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [heroRef]);

  // Foco por teclado nunca fica escondido atrás da barra.
  useEffect(() => {
    const root = document.documentElement;
    if (!show) return;
    root.style.scrollPaddingBottom = `${(bar.current?.offsetHeight ?? 80) + 8}px`;
    return () => {
      root.style.scrollPaddingBottom = "";
    };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={bar}
          initial={reduce ? false : { y: "100%" }}
          animate={{ y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { y: "100%" }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_12px_-10px_rgba(20,24,31,0.3)] min-[769px]:hidden"
        >
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <p className="text-sm leading-tight text-ink-soft">
              A partir de
              <span className="block font-mono text-base font-medium text-ink">{ENTRY_PRICE_BRL}/mês</span>
            </p>
            <a
              href={asset("/planos")}
              onClick={e => {
                e.preventDefault();
                track("cta_click");
                navigate("/planos");
              }}
              className="inline-flex h-12 min-w-28 items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Ver planos
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
