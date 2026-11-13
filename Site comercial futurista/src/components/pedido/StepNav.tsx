import { motion } from "motion/react";
import { FRAMES } from "../../data/pedido";
import { EASE } from "../../lib/motion";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Passos da história como botões: lista no desktop; no celular, legenda do passo atual + 7 botões numerados. */
export function StepNav({ frame, onSelect }: { frame: number; onSelect: (i: number) => void }) {
  const current = FRAMES[frame];
  return (
    <>
      <ol className="mt-5 hidden space-y-0.5 lg:block">
        {FRAMES.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === frame ? "step" : undefined}
              className={`group relative min-h-11 w-full rounded-xl py-2 pl-11 pr-3 text-left ${FOCUS}`}
            >
              {i === frame && <motion.span layoutId="passo-ativo" className="absolute inset-0 rounded-xl bg-band-raised" transition={{ duration: 0.5, ease: EASE }} />}
              <span
                className={`absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-full font-mono text-xs ${
                  i <= frame ? "bg-accent text-white" : "border border-line text-ink-soft"
                }`}
              >
                {i + 1}
              </span>
              <span className={`relative block text-sm font-semibold ${i === frame ? "text-ink" : "text-ink-soft"}`}>{s.title}</span>
              {i === frame && <span className="relative mt-0.5 block text-sm text-ink-soft">{s.text}</span>}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 lg:hidden">
        <p className="font-mono text-xs text-accent-text">
          {frame + 1}/{FRAMES.length} · {current.title}
        </p>
        <p className="mt-1 min-h-[4.5rem] text-sm text-ink-soft">{current.text}</p>
        <div className="mt-2 flex gap-0.5">
          {FRAMES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Passo ${i + 1}: ${s.title}`}
              aria-current={i === frame ? "step" : undefined}
              className={`h-11 min-w-0 flex-1 rounded-xl font-mono text-xs ${FOCUS} ${i === frame ? "bg-accent text-white" : "border border-line text-ink-soft"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
