import { motion } from "motion/react";
import { Link } from "wouter";
import { PARA_QUEM } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";

const ICONS = [
  // salão e mesas
  "M3 9h18M5 9v10M19 9v10M8 4h8v5H8z",
  // delivery
  "M6 8h12l-1 12H7L6 8zm3 0V6a3 3 0 0 1 6 0v2",
  // começando
  "M12 21V11m0 0c0-4-3.5-5.5-7.5-5.5 0 4 3 6 7.5 5.5zm0 3c0-3 2.7-4.3 6-4.3 0 3.3-2.6 4.9-6 4.3z",
  // equipe maior
  "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6m1-12a3 3 0 1 1 0 6m3 6c1.8.5 3 2.2 3 5",
];

/** "Serve pro seu restaurante, seja qual for o formato" (site atual), com o plano que costuma servir a cada formato. */
export function ParaQuem() {
  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="para-quem-title">
      <SectionHeading
        id="para-quem-title"
        eyebrow="Para quem é"
        title="Serve pro seu restaurante, seja qual for o formato"
        lead="Salão, delivery, começando agora ou com equipe grande — o sistema se adapta."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PARA_QUEM.map((item, i) => (
          <motion.article key={item.title} {...reveal(i * 0.06)} className="flex flex-col rounded-[1.75rem] border border-line bg-bg-raised p-6">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent-text" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={ICONS[i]} />
            </svg>
            <h3 className="mt-5 font-display text-lg font-semibold leading-tight">{item.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">{item.description}</p>
            <Link href="/planos" className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-text hover:text-ink">
              Indicado: {item.plan} <span aria-hidden="true">→</span>
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
