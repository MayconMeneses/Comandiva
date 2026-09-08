import { ChevronDown } from "lucide-react";
import { useState } from "react";

/** Accordion reaproveitado onde uma seção inteira (não item por item) precisa abrir/fechar — mesmo padrão usado no cardápio do admin e no mapa de mesas. */
export default function CollapsibleSection({ title, badge, defaultOpen = false, children }: { title: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return <section className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
    <button type="button" onClick={() => setIsOpen(value => !value)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[#f6ede0]">
      <div className="min-w-0">{title}</div>
      <div className="flex shrink-0 items-center gap-3">{badge}<ChevronDown className={`h-5 w-5 text-[#8a5c3f] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} /></div>
    </button>
    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
      <div className="overflow-hidden"><div className="border-t border-[#eee5d9] p-4">{children}</div></div>
    </div>
  </section>;
}
