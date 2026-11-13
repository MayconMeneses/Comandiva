import type { ReactNode } from "react";
import { motion } from "motion/react";
import { reveal } from "../../lib/motion";

/**
 * Título de seção: número discreto (opcional) e título em Satoshi, sem pílula.
 * `eyebrow` segue aceito por compatibilidade e vira um rótulo comum ao lado do número.
 * Alinhamento padrão à esquerda; `align="center"` centraliza.
 */
export function SectionHeading({
  id,
  eyebrow,
  number,
  title,
  lead,
  align = "left",
}: {
  id: string;
  eyebrow?: string;
  number?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  const label = number || eyebrow;
  return (
    <motion.div {...reveal()} className={centered ? "mx-auto max-w-2xl text-center" : "mx-auto max-w-6xl"}>
      <div className={centered ? "" : "max-w-2xl"}>
      {label && (
        <p className="text-sm text-ink-soft">
          {number && <span className="font-mono">{number}</span>}
          {number && eyebrow && <span className="mx-2" aria-hidden="true">-</span>}
          {eyebrow}
        </p>
      )}
      <h2 id={id} className={`${label ? "mt-3" : ""} text-[clamp(1.75rem,3.6vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.02em] text-balance`}>
        {title}
      </h2>
      {lead && <p className={`mt-4 max-w-xl text-lg leading-relaxed text-ink-soft ${centered ? "mx-auto" : ""}`}>{lead}</p>}
    </div>
    </motion.div>
  );
}
