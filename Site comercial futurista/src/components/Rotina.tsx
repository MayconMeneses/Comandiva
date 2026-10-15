import { motion } from "motion/react";
import { ROTINA, RESUMO } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";

/**
 * "Seu tempo vale mais que planilha e comanda de papel" + "Por que escolher
 * o Comandiva?" (as duas seções do site atual, juntas). Fotos da rotina
 * recortadas sem o logo e as frases que vinham gravadas na imagem — os
 * títulos agora são texto de verdade. Leve: só imagem lazy e entrada ao rolar.
 */
export function Rotina() {
  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="rotina-title">
      <SectionHeading
        id="rotina-title"
        eyebrow="Sua rotina"
        title="Seu tempo vale mais que planilha e comanda de papel"
        lead="Você cuida do restaurante. O sistema cuida da correria."
      />

      <div className="mx-auto mt-14 grid max-w-6xl gap-5 md:grid-cols-3">
        {ROTINA.map((item, i) => (
          <motion.article key={item.title} {...reveal(i * 0.08)} className="group rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
            <div className="overflow-hidden rounded-[calc(2rem-0.375rem)] bg-bg-raised">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={item.image}
                  width={item.w}
                  height={item.h}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-xl font-semibold leading-tight">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.description}</p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>

      <div className="mx-auto mt-24 max-w-6xl">
        <motion.h2 {...reveal()} id="resumo-title" className="text-center font-display text-[clamp(1.8rem,3.5vw,2.75rem)] font-semibold tracking-[-0.02em]">
          Por que escolher o Comandiva?
        </motion.h2>
        <dl className="mt-10 grid gap-px overflow-hidden rounded-[1.75rem] border border-line bg-line md:grid-cols-3" aria-labelledby="resumo-title">
          {RESUMO.map((item, i) => (
            <motion.div key={item.title} {...reveal(i * 0.08)} className="bg-bg p-7">
              <p aria-hidden="true" className="font-display text-5xl font-semibold tracking-tight text-accent-text">
                {item.figure}
              </p>
              <dt className="mt-5 font-semibold text-ink">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{item.description}</dd>
            </motion.div>
          ))}
        </dl>
      </div>
    </section>
  );
}
