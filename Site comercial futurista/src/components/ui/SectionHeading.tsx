import type { ReactNode } from "react";
import { motion } from "motion/react";
import { reveal } from "../../lib/motion";

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <motion.div {...reveal()} className={centered ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">{eyebrow}</p>
      <h2 id={id} className="mt-4 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1] tracking-[-0.02em] text-balance">
        {title}
      </h2>
      {lead && <p className={`mt-5 text-ink-soft ${centered ? "mx-auto max-w-xl" : "max-w-xl"}`}>{lead}</p>}
    </motion.div>
  );
}
