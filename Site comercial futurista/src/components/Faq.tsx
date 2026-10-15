import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FAQ } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { EASE, reveal } from "../lib/motion";

/**
 * Perguntas frequentes com abertura em mola e destaque que desliza para a
 * pergunta aberta (referências: Accordion ddoemonn e Animated Line
 * Accordion, 21st.dev). Uma aberta por vez; botões com aria-expanded.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();

  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" eyebrow="Perguntas frequentes" title="Antes de você perguntar" />
      <motion.ul {...reveal(0.1)} className="mx-auto mt-14 max-w-3xl space-y-2">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          const panel = `${base}-p${i}`;
          return (
            <li key={item.question} className="relative">
              {isOpen && (
                <motion.span layoutId="faq-ativo" className="absolute inset-0 rounded-[1.5rem] border border-white/10 bg-bg-raised" transition={{ duration: 0.5, ease: EASE }} />
              )}
              <button
                type="button"
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
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={panel}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className="relative overflow-hidden"
                  >
                    <p className="px-5 pb-6 pl-14 text-ink-soft sm:px-6 sm:pl-[3.75rem]">{item.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </motion.ul>
    </section>
  );
}
