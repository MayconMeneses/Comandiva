import type { CSSProperties, ReactNode } from "react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * Wrapper fino pra aplicar a entrada suave do useScrollReveal.ts sem
 * repetir ref/classe em cada seção do site comercial. `delayMs` só
 * escalona quando várias instâncias entram juntas (ex.: os cards de um
 * grid) — sem exagerar, é um detalhe, não uma sequência de slide.
 */
export function Reveal({ children, className = "", delayMs = 0, style, id, tabIndex }: { children: ReactNode; className?: string; delayMs?: number; style?: CSSProperties; id?: string; tabIndex?: number }) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      id={id}
      tabIndex={tabIndex}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className}`}
      style={{ ...style, ...(visible && delayMs ? { transitionDelay: `${delayMs}ms` } : null) }}
    >
      {children}
    </div>
  );
}
