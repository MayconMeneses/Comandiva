import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";
import { TELAS } from "../data/home";

function StackCard({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const tela = TELAS[index];
  const total = TELAS.length;
  // Cada cartão encolhe um pouco quando o próximo chega por cima.
  const start = index / total;
  const scale = useTransform(progress, [start, 1], [1, 1 - (total - index) * 0.04]);

  return (
    <div className="sticky flex h-[100dvh] items-center justify-center" style={{ top: `${index * 14}px` }}>
      <motion.figure
        style={{ scale, transformOrigin: "50% 0%" }}
        className="w-full max-w-5xl rounded-[2rem] border border-white/10 bg-bg-raised p-1.5 shadow-[0_-20px_60px_-30px_rgba(0,0,0,.9)]"
      >
        <div className="grid overflow-hidden rounded-[calc(2rem-0.375rem)] bg-bg md:grid-cols-[1fr_1.7fr]">
          <figcaption className="flex flex-col justify-between gap-4 p-6 sm:p-8">
            <span className="font-mono text-xs text-accent-text">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <div>
              <p className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{tela.title}</p>
              <p className="mt-3 text-sm text-ink-soft">{tela.caption}</p>
            </div>
          </figcaption>
          <div className="flex items-center bg-[#f6f1e8] p-2 sm:p-3">
            <img src={tela.src} width={tela.w} height={tela.h} loading="lazy" decoding="async" alt={tela.alt} className="max-h-[52dvh] w-full rounded-xl object-contain" />
          </div>
        </div>
      </motion.figure>
    </div>
  );
}

/**
 * As outras telas reais empilhando ao rolar (adaptado do "Scroll Cards",
 * 21st.dev: sem next/image, com escala no cartão de baixo e moldura da marca).
 */
export function ScreenStack() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <div ref={ref} className="relative px-4 sm:px-6" aria-label="Telas reais do sistema">
      {TELAS.map((t, i) => (
        <StackCard key={t.src} index={i} progress={scrollYProgress} />
      ))}
    </div>
  );
}
