import { motion } from "motion/react";

const TONES = {
  ok: "border-ok text-ok",
  accent: "border-accent text-accent",
  warm: "border-warm-ink text-warm-ink",
  light: "border-band-ink text-band-ink",
  late: "border-late-ink text-late-ink",
} as const;

/**
 * Carimbo de borracha: borda dupla, tinta falhada e a "batida" ao aparecer
 * (escala grande → 1 com um leve tranco). Referência visual: Stamp, da
 * coleção Kitchen (dqnamo.com) — reescrito do zero. Reutilizável: pedidos
 * pagos, comandas fechadas, plano recomendado.
 *
 * `play` dispara a batida; troque a `key` para carimbar de novo.
 */
export function Stamp({
  text,
  sub,
  tone = "ok",
  rotate = -8,
  play = true,
  delay = 0,
  className = "",
}: {
  text: string;
  sub?: string;
  tone?: keyof typeof TONES;
  rotate?: number;
  play?: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.span
      role="img"
      aria-label={sub ? `${text}, ${sub}` : text}
      initial={{ opacity: 0, scale: 2.2, rotate: rotate - 12 }}
      animate={play ? { opacity: 0.92, scale: 1, rotate } : undefined}
      transition={{ delay, duration: 0.32, ease: [0.2, 1.5, 0.45, 1] }}
      className={`stamp-ink pointer-events-none inline-flex select-none flex-col items-center rounded-sm border-[3px] border-double px-3 py-1.5 text-center font-mono font-medium uppercase leading-none tracking-[0.08em] ${TONES[tone]} ${className}`}
    >
      <span className="text-[13px]">{text}</span>
      {sub && <span className="mt-1 text-xs tracking-[0.08em]">{sub}</span>}
    </motion.span>
  );
}
