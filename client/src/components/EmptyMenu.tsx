import { UtensilsCrossed } from "lucide-react";

export default function EmptyMenu({ openingHours }: { openingHours?: string | null }) {
  return <section id="cardapio" className="page-shell py-10 sm:py-14"><div className="rounded-3xl border border-dashed border-[#d9c9b4] bg-[#f3eadf] p-10 text-center text-[#231d18] sm:p-14"><UtensilsCrossed className="mx-auto h-9 w-9 text-primary" /><h2 className="mt-4 font-display text-3xl font-bold">Estamos fechados no momento.</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8a7a68]">Nenhuma categoria do cardápio está disponível agora{openingHours ? `. Voltamos: ${openingHours}` : "."}</p></div></section>;
}
