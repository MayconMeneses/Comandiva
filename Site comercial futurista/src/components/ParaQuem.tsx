import { motion } from "motion/react";
import { Link } from "wouter";
import { PARA_QUEM } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";
import { ArrowIcon } from "./ui/Icons";
import { Marked } from "./ui/Kw";

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
        title={<Marked text="Serve pro seu restaurante, seja qual for o formato" phrase="seja qual for o formato" />}
        lead="Salão, delivery, começando agora ou com equipe grande: o sistema se adapta."
      />
      <ul className="mx-auto mt-12 grid max-w-6xl gap-3">
        {PARA_QUEM.map((item, i) => (
          <motion.li
            key={item.title}
            {...reveal(i * 0.05)}
            className="card-lift grid items-start gap-x-8 gap-y-2 rounded-2xl border border-line bg-bg-raised p-6 md:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_12rem]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-hero text-white">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={ICONS[i]} />
              </svg>
            </span>
            <h3 className="font-display text-lg font-semibold leading-tight">{item.title}</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{item.description}</p>
            <Link href="/planos" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent hover:text-ink md:justify-end">
              Indicado: {item.plan} <ArrowIcon />
            </Link>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
