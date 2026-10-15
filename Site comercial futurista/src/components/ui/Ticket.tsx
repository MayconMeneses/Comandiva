import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";

/**
 * Ingresso picotado: parte de cima e de baixo separadas por um picote com
 * dois recortes laterais, e uma inclinação leve que segue o mouse
 * (parallax). Referência visual: Ticket, da coleção Kitchen (dqnamo.com) —
 * reescrito do zero. Reutilizável: planos, comandas, cupons.
 *
 * Os recortes laterais são furos de verdade (máscara CSS), então o
 * ingresso funciona sobre qualquer fundo, inclusive degradê.
 */
export function Ticket({
  top,
  bottom,
  highlighted = false,
  className = "",
}: {
  top: ReactNode;
  bottom: ReactNode;
  highlighted?: boolean;
  className?: string;
}) {
  // Altura da parte de cima: define onde ficam os furos do picote.
  const topRef = useRef<HTMLDivElement>(null);
  const [cutY, setCutY] = useState(0);
  useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCutY(el.offsetHeight + 12));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const holes = cutY
    ? `radial-gradient(circle 12px at 0 ${cutY}px, transparent 11.5px, #000 12px), radial-gradient(circle 12px at 100% ${cutY}px, transparent 11.5px, #000 12px)`
    : undefined;

  const reduce = useReducedMotion();
  const rx = useSpring(0, { stiffness: 180, damping: 18 });
  const ry = useSpring(0, { stiffness: 180, damping: 18 });
  const glare = useTransform(ry, [-6, 6], [20, 80], { clamp: true });
  const glareBg = useTransform(glare, x => `radial-gradient(300px circle at ${x}% 0%, rgba(255,255,255,.06), transparent 70%)`);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 10);
    rx.set(-py * 8);
  }
  function reset() {
    rx.set(0);
    ry.set(0);
  }

  const border = highlighted ? "border-accent/70" : "border-white/10";

  return (
    <div className={`[perspective:1100px] ${className}`} onPointerMove={onMove} onPointerLeave={reset}>
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", WebkitMaskImage: holes, maskImage: holes, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
        className={`relative flex h-full flex-col rounded-[1.75rem] border bg-bg-raised shadow-[0_30px_60px_-35px_rgba(0,0,0,.95)] ${border} ${
          highlighted ? "shadow-[0_0_0_1px_rgba(0,140,254,.25),0_30px_60px_-35px_rgba(0,0,0,.95)]" : ""
        }`}
      >
        {/* reflexo discreto que acompanha a inclinação */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] opacity-60"
          style={{ background: glareBg }}
        />
        <div ref={topRef} className="relative p-6 sm:p-7" style={{ transform: "translateZ(24px)" }}>
          {top}
        </div>

        {/* Picote */}
        <div className="relative h-6" aria-hidden="true">
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
        </div>

        <div className="relative flex-1 p-6 pt-4 sm:p-7 sm:pt-4" style={{ transform: "translateZ(12px)" }}>
          {bottom}
        </div>
      </motion.div>
    </div>
  );
}
