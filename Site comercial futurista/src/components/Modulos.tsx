import { motion } from "motion/react";
import { Link } from "wouter";
import { MODULOS } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";

/**
 * "Um sistema completo, sem juntar outros por fora" (site atual), no visual
 * de cardápio: cada módulo é uma linha numerada com pontilhado até o selo.
 */
export function Modulos() {
  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="modulos-title">
      <SectionHeading
        id="modulos-title"
        eyebrow="Módulos"
        title="Um sistema completo, sem juntar outros por fora"
        lead="Tudo no mesmo painel — cresce junto com o plano escolhido."
      />
      <motion.ol {...reveal(0.1)} className="mx-auto mt-14 max-w-4xl divide-y divide-line rounded-[1.75rem] border border-line bg-bg-raised">
        {MODULOS.map((m, i) => (
          <li key={m.title} className="grid gap-2 p-6 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline sm:gap-6">
            <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-display text-xl font-semibold">{m.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{m.description}</p>
            </div>
            <span className="w-fit rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
              {m.badge ?? "Todos os planos"}
            </span>
          </li>
        ))}
      </motion.ol>
      <div className="mt-10 text-center">
        <Link
          href="/planos"
          className="inline-flex h-12 items-center rounded-full border border-line px-6 text-sm font-semibold text-ink transition-colors hover:bg-bg-raised"
        >
          Ver planos e recursos completos
        </Link>
      </div>
    </section>
  );
}
