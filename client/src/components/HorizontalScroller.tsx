import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";

export default function HorizontalScroller({ children, trackClassName = "" }: { children: React.ReactNode; trackClassName?: string }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const handle = () => updateArrows();
    el.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => { el.removeEventListener("scroll", handle); window.removeEventListener("resize", handle); };
  });

  const scrollByPage = (direction: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  const arrowClass = "absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/20 text-white opacity-80 backdrop-blur-sm transition hover:bg-black/40 hover:opacity-100";

  return <div className="relative">
    {canScrollLeft && <button type="button" onClick={() => scrollByPage(-1)} aria-label="Voltar" className={`${arrowClass} left-1`}><ChevronLeft className="h-5 w-5" /></button>}
    <div ref={scrollerRef} className={`pubx-no-scrollbar flex overflow-x-auto ${trackClassName}`}>{children}</div>
    {canScrollRight && <button type="button" onClick={() => scrollByPage(1)} aria-label="Avançar" className={`${arrowClass} right-1`}><ChevronRight className="h-5 w-5" /></button>}
  </div>;
}
