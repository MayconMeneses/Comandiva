import { motion, type MotionValue } from "motion/react";

/** Cursor fantasma (decorativo): seta SVG que segue MotionValues de posição, opacidade e "clique". */
export function GhostCursor({ left, top, opacity, scale }: { left: MotionValue<string>; top: MotionValue<string>; opacity: MotionValue<number>; scale: MotionValue<number> }) {
  return (
    <motion.svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute z-20 h-7 w-7"
      style={{ left, top, opacity, scale, transformOrigin: "4px 3px" }}
    >
      <path d="M4 3l15 7.2-6.3 1.9L10 18.5z" fill="#fff" stroke="#111319" strokeWidth="1.6" strokeLinejoin="round" />
    </motion.svg>
  );
}
