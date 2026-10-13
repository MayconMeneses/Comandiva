import { defaultCategoryIcon } from "@/lib/categoryIcons";
import SmartImage from "@/components/SmartImage";
import HorizontalScroller from "@/components/HorizontalScroller";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MenuCategory, MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/**
 * Cardápio em lista única (todas as categorias, todos os produtos, um
 * embaixo do outro) com uma barra de categorias fixa no topo — ao rolar, a
 * categoria destacada acompanha automaticamente o que está visível na tela
 * (scroll-spy), e tocar numa categoria da barra rola até ela. A barra
 * (CategoryTabBar) e a lista de produtos (CategoryProductSections) são
 * peças separadas de propósito — no pedido pelo QR Code da mesa a barra
 * precisa ficar ACIMA da busca por nome, não colada na lista (ver pedido do
 * dono, 2026-09-10).
 */
export function useCategoryScrollSpy(categories: MenuCategory[]) {
  const [activeId, setActiveId] = useState<number | null>(categories[0]?.id ?? null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  // Enquanto o próprio clique na aba está rolando a página até a seção, o
  // scroll-spy fica pausado — sem isso, ele "briga" com o scroll suave e a
  // aba destacada pisca entre a categoria de origem e a de destino.
  const isProgrammaticScroll = useRef(false);

  useEffect(() => {
    if (!categories.length) return;
    const observer = new IntersectionObserver(
      entries => {
        if (isProgrammaticScroll.current) return;
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = visible[0] && Number((visible[0].target as HTMLElement).dataset.categoryId);
        if (topId) setActiveId(topId);
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    Object.values(sectionRefs.current).forEach(section => section && observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (activeId != null) tabRefs.current[activeId]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  const goToCategory = (id: number) => {
    isProgrammaticScroll.current = true;
    setActiveId(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => { isProgrammaticScroll.current = false; }, 700);
  };

  return { activeId, sectionRefs, tabRefs, goToCategory };
}

type ScrollSpy = ReturnType<typeof useCategoryScrollSpy>;

/** Barra fixa de categorias (ícone redondo + nome) — fica presa no topo da tela enquanto o cliente rola os produtos. */
export function CategoryTabBar({ categories, spy, marca }: { categories: MenuCategory[]; spy: ScrollSpy; marca?: boolean }) {
  if (!categories.length) return null;
  return <div className="sticky top-0 z-20 -mx-4 border-b border-[#e4d8c8] bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-0 sm:px-1">
    <HorizontalScroller trackClassName="gap-3">
      {categories.map(category => <button key={category.id} ref={element => { spy.tabRefs.current[category.id] = element; }} type="button" onClick={() => spy.goToCategory(category.id)} className={`flex w-16 shrink-0 flex-col items-center gap-1.5 rounded-xl p-1 text-center transition ${spy.activeId === category.id ? "bg-[#fdf1eb]" : "hover:bg-[#f3eadf]"}`}><span className={`grid h-12 w-12 place-items-center overflow-hidden rounded-full border-2 ${spy.activeId === category.id ? "border-primary" : "border-[#e4d6c4]"} bg-[#fffdf8]`}><SmartImage src={category.imageUrl || defaultCategoryIcon(category.name)} alt="" className="h-full w-full object-cover" /></span><span className={`line-clamp-2 text-[10px] font-semibold leading-tight ${marca ? "text-[#f5f5f0]" : spy.activeId === category.id ? "text-[#9f3d26]" : "text-[#4a4037]"}`}>{category.name}</span></button>)}
    </HorizontalScroller>
  </div>;
}

/** Todas as categorias com seus produtos, uma seção embaixo da outra — cada seção é o alvo do scroll-spy da CategoryTabBar. */
export function CategoryProductSections({ categories, spy, onSelect }: { categories: MenuCategory[]; spy: ScrollSpy; onSelect: (product: MenuProduct) => void }) {
  if (!categories.length) return null;
  return <div className="space-y-8">
    {categories.map(category => <section key={category.id} ref={element => { spy.sectionRefs.current[category.id] = element; }} data-category-id={category.id} className="scroll-mt-24">
      <h3 className="mb-3 font-display text-xl font-bold">{category.name}</h3>
      <div className="space-y-3">{category.products.map(product => <button key={product.id} type="button" onClick={() => onSelect(product)} className="flex w-full items-center gap-3 rounded-2xl border border-[#e3d6c6] bg-[#fffdf8] p-3 text-left text-[#231d18] shadow-[0_4px_14px_rgba(53,34,17,.05)] transition hover:border-primary"><span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#e6d9c7]"><SmartImage src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1"><span className="block font-display text-base font-bold leading-tight">{product.name}</span>{product.description && <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[#8a7a68]">{product.description}</span>}<span className="mt-1 block text-sm font-bold text-primary">{money(product.priceCents)}</span></span><Plus className="h-5 w-5 shrink-0 text-primary" /></button>)}</div>
    </section>)}
  </div>;
}
