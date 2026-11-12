import { useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import { FAQ } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { EASE, reveal } from "../lib/motion";
import { scrollToHashWhenReady } from "../lib/scroll";

/**
 * Perguntas frequentes com abertura em mola e destaque que desliza para a
 * pergunta aberta (referências: Accordion ddoemonn e Animated Line
 * Accordion, 21st.dev). Uma aberta por vez; botões com aria-expanded.
 * Os painéis ficam sempre no DOM (escondidos quando fechados), para o
 * aria-controls apontar para um elemento real. Abre por âncora (#faq-2).
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  useEffect(() => {
    const n = Number(/^#faq-(\d+)$/.exec(window.location.hash)?.[1]);
    if (n >= 1 && n <= FAQ.length) {
      setOpen(n - 1);
      // Espera o item anterior fechar para a posição final do alvo estabilizar.
      const t = window.setTimeout(() => scrollToHashWhenReady(window.location.hash), 500);
      return () => window.clearTimeout(t);
    }
  }, []);

  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" eyebrow="Perguntas frequentes" title="Antes de você perguntar" />
      <motion.ul {...reveal(0.1)} className="mx-auto mt-14 max-w-3xl space-y-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          const panel = `${base}-p${i}`;
          return (
            <li key={item.question} id={`faq-${i + 1}`} className="relative scroll-mt-24">
              {isOpen && (
                <motion.span layoutId="faq-ativo" className="absolute inset-0 rounded-[1.5rem] border border-white/10 bg-bg-raised" transition={{ duration: 0.5, ease: EASE }} />
              )}
              <button
                type="button"
                id={`${panel}-q`}
                aria-expanded={isOpen}
                aria-controls={panel}
                onClick={() => setOpen(isOpen ? null : i)}
                className="relative flex w-full items-center gap-4 rounded-[1.5rem] px-5 py-5 text-left sm:px-6"
              >
                <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                <span className={`flex-1 font-display text-lg font-semibold ${isOpen ? "text-ink" : "text-ink-soft"}`}>{item.question}</span>
                <motion.span aria-hidden="true" animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.4, ease: EASE }} className="text-xl text-ink-soft">
                  +
                </motion.span>
              </button>
              <motion.div
                id={panel}
                role="region"
                aria-labelledby={`${panel}-q`}
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0, visibility: isOpen ? "visible" : "hidden" }}
                transition={{ duration: 0.45, ease: EASE }}
                className="relative overflow-hidden"
              >
                <p className="px-5 pb-6 pl-14 text-ink-soft sm:px-6 sm:pl-[3.75rem]">{item.answer}</p>
              </motion.div>
            </li>
          );
        })}
      </motion.ul>
    </section>
  );
}
