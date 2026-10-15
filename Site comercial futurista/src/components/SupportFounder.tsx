import { motion } from "motion/react";
import { SUPORTE } from "../data/home";
import { EASE, reveal } from "../lib/motion";
import { Signature } from "./ui/Signature";

/** Trecho marcado como caneta marca-texto ao entrar na tela (referência: Text Highlighter, 21st.dev). */
function Marker({ children }: { children: string }) {
  return (
    <span className="relative whitespace-nowrap">
      <motion.span
        aria-hidden="true"
        className="absolute inset-x-[-4px] bottom-[0.08em] top-[0.45em] -z-0 origin-left rounded-sm bg-accent/35"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ duration: 0.9, delay: 0.3, ease: EASE }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** Suporte + quem criou, juntos: "você fala com quem construiu o sistema". */
export function SupportFounder() {
  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="suporte-title">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <motion.div {...reveal()}>
          <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">
            Suporte e quem criou
          </p>
          <h2 id="suporte-title" className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1] tracking-[-0.02em] text-balance">
            Você fala direto com quem construiu o sistema
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            O Comandiva é um projeto <Marker>100% autoral</Marker>, idealizado, projetado e construído do zero por Maycon Meneses, sem
            plataforma no-code por trás e sem terceirização. Da ideia ao código, cada parte foi pensada pra resolver o problema de verdade
            de quem administra um restaurante.
          </p>
          <div className="mt-8">
            <Signature name="Maycon Meneses" className="h-20 w-auto text-ink sm:h-24" />
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Maycon Meneses · Ideias · Sistemas · Soluções</p>
          </div>
        </motion.div>

        <ul className="grid gap-3 self-center">
          {SUPORTE.map((item, i) => (
            <motion.li key={item.title} {...reveal(0.1 + i * 0.1)} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-1.5">
              <div className="flex gap-4 rounded-[calc(1.5rem-0.375rem)] bg-bg-raised p-5">
                <span className="font-mono text-xs text-accent-text">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-soft">{item.description}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
