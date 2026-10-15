import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring } from "motion/react";

/**
 * Link que é "puxado" na direção do cursor e volta com mola ao sair
 * (referência: "Magnetic Button", 21st.dev). Só reage a mouse; em toque
 * e com movimento reduzido fica parado.
 */
export function MagneticLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 18, mass: 0.4 });

  function onPointerMove(e: React.PointerEvent) {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a ref={ref} href={href} className={className} style={{ x, y }} onPointerMove={onPointerMove} onPointerLeave={reset} onClick={onClick}>
      {children}
    </motion.a>
  );
}
