import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/**
 * Print real do painel de pedidos que começa inclinado em 3D e se endireita
 * conforme a rolagem (o dono gostou desta animação; voltou em 2026-10-14).
 * Adaptado do "Container Scroll Animation" (Aceternity, via 21st.dev):
 * framer-motion → motion, mesma escala em qualquer tela, moldura da marca.
 * O print teve a barra de rolagem falsa recortada e o corte de baixo vira
 * um degradê, para não parecer uma área rolável. Único brilho (glow) do site.
 */
export function PanelShowcase() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);

  return (
    <section ref={ref} className="relative px-4 pb-16 pt-28 sm:px-6" aria-labelledby="telas-title">
      <div className="mx-auto max-w-3xl text-center">
        <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">
          Telas reais
        </p>
        <h2 id="telas-title" className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-none tracking-[-0.02em] text-balance">
          Pedidos em andamento, do jeito que você vai ver
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-ink-soft">
          Telas reais do sistema em funcionamento, com dados de demonstração.
        </p>
      </div>

      <div className="relative mx-auto mt-14 max-w-6xl [perspective:1200px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[10%] top-[10%] h-[70%] rounded-full opacity-60 blur-[90px]"
          style={{ background: "radial-gradient(closest-side, var(--accent), var(--accent-2) 60%, transparent)" }}
        />
        <motion.figure
          style={{ rotateX, scale, transformOrigin: "50% 0%" }}
          className="relative rounded-[2rem] border border-white/10 bg-bg-raised p-1.5 shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] md:p-2"
        >
          <div className="relative overflow-hidden rounded-[calc(2rem-0.375rem)]">
            <img
              src="/assets/pedidos.webp"
              width={1353}
              height={577}
              loading="lazy"
              decoding="async"
              alt="Painel de pedidos do restaurante com colunas Aguardando aceite, Aceitos e Em produção"
              className="block w-full"
            />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-bg-raised to-transparent" />
          </div>
          <figcaption className="px-3 pb-2 pt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
            Print real do sistema · dados de demonstração
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
