import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Ingresso picotado: parte de cima e de baixo separadas por um picote com
 * dois recortes laterais. Referência visual: Ticket, da coleção Kitchen
 * (dqnamo.com), reescrito do zero. Reutilizável: planos, comandas, cupons.
 *
 * Os recortes laterais são furos de verdade (máscara CSS), então o
 * ingresso funciona sobre qualquer fundo. Sem inclinação, brilho nem sombra grande.
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

  const border = highlighted ? "border-accent" : "border-line";

  return (
    <div className={className}>
      <div
        style={{ WebkitMaskImage: holes, maskImage: holes, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}
        className={`relative flex h-full flex-col rounded-3xl border bg-bg-raised ${border}`}
      >
        <div ref={topRef} className="relative p-6 sm:p-7">
          {top}
        </div>

        {/* Picote */}
        <div className="relative h-6" aria-hidden="true">
          <span className="absolute inset-x-5 top-1/2 border-t-2 border-dashed border-line" />
        </div>

        <div className="relative flex-1 p-6 pt-4 sm:p-7 sm:pt-4">{bottom}</div>
      </div>
    </div>
  );
}
