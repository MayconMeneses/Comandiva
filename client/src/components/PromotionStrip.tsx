import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import ProductDialog from "@/components/ProductDialog";
import SmartImage from "@/components/SmartImage";
import HorizontalScroller from "@/components/HorizontalScroller";
import { ArrowRight, Flame, X } from "lucide-react";
import { useState } from "react";
import type { MenuCategory, MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type PromotionAddonGroup = { id: number; minSelections: number; promotionDefault: { mode: "ADMIN_DEFAULT" | "CUSTOMER_CHOICE"; defaultOptionId: number | null } | null };
type PromotionProduct = { id: number; name: string; imageUrl: string | null; priceCents: number; addonGroups: PromotionAddonGroup[] };
type PromotionRecord = { id: number; title: string; description: string | null; promoPriceCents: number | null; validDays: string | null; products: PromotionProduct[] };

export default function PromotionStrip({ categories, onSelectProduct }: { categories: MenuCategory[]; onSelectProduct: (product: MenuProduct) => void }) {
  const promotions = trpc.catalog.promotions.useQuery();
  const events = trpc.catalog.events.useQuery();
  const { addItem } = useCart();
  const [openEvent, setOpenEvent] = useState<{ title: string; description: string | null; imageUrl: string | null; eventDate: string | null } | null>(null);
  // Itens do combo cujo adicional obrigatório o admin marcou como "cliente
  // escolhe" — processados um de cada vez pelo ProductDialog normal, em vez
  // de forçar uma opção qualquer por eles.
  const [choiceQueue, setChoiceQueue] = useState<MenuProduct[]>([]);
  if (!promotions.data?.length && !events.data?.length) return null;
  const priceDisplay = (promotion: PromotionRecord) => {
    const normalTotal = promotion.products.reduce((sum, product) => sum + product.priceCents, 0);
    if (promotion.promoPriceCents != null && normalTotal > 0) {
      const discountPct = Math.round((1 - promotion.promoPriceCents / normalTotal) * 100);
      return <span className="flex flex-col items-end"><span className="text-[10px] leading-none text-[#a08f7e] line-through sm:text-[11px]">{money(normalTotal)}</span><strong className="whitespace-nowrap text-sm text-primary sm:text-base">{money(promotion.promoPriceCents)} {discountPct > 0 && <span className="ml-0.5 text-[10px] font-bold text-emerald-700">-{discountPct}%</span>}</strong></span>;
    }
    return <strong className="whitespace-nowrap text-sm text-primary sm:text-base">{money(normalTotal)}</strong>;
  };
  const allProducts = categories.flatMap(category => category.products);
  const openPromotion = (promotion: PromotionRecord) => {
    if (promotion.products.length === 1) {
      // Produto único: abre a personalização normal (com adicionais), usando
      // o produto completo do cardápio público (a lista da promoção só traz
      // id/nome/imagem/preço, o suficiente pra exibição, não pra montar o item).
      const fullProduct = allProducts.find(product => product.id === promotion.products[0]!.id);
      if (fullProduct) { onSelectProduct(fullProduct); return; }
    }
    // Combo com vários produtos: em geral adiciona tudo direto na sacola (o
    // aviso de "item adicionado" já existente na Home cuida do feedback pro
    // cliente). Mas se algum item tiver adicional obrigatório (ex.: tamanho,
    // ponto da carne), a resolução configurada pelo admin decide o que fazer:
    // ADMIN_DEFAULT usa a opção fixa escolhida; CUSTOMER_CHOICE (ou nenhuma
    // configuração) obriga abrir a personalização normal pra esse item, em
    // vez de forçar uma opção qualquer sem o cliente perceber.
    const needsChoice: MenuProduct[] = [];
    promotion.products.forEach(promoProduct => {
      const fullProduct = allProducts.find(candidate => candidate.id === promoProduct.id);
      const requiredGroups = (fullProduct?.addonGroups ?? []).filter(group => group.minSelections > 0);
      const unresolved = requiredGroups.some(group => {
        const config = promoProduct.addonGroups.find(promoGroup => promoGroup.id === group.id)?.promotionDefault;
        return !config || config.mode !== "ADMIN_DEFAULT" || !config.defaultOptionId;
      });
      if (unresolved) {
        if (fullProduct) needsChoice.push(fullProduct);
        return;
      }
      const addons = requiredGroups.flatMap(group => {
        const config = promoProduct.addonGroups.find(promoGroup => promoGroup.id === group.id)?.promotionDefault;
        const option = group.options.find(candidate => candidate.id === config?.defaultOptionId);
        return option ? [{ id: option.id, groupId: group.id, groupName: group.name, name: option.name, priceCents: option.priceCents }] : [];
      });
      addItem({ productId: promoProduct.id, name: promoProduct.name, imageUrl: promoProduct.imageUrl, basePriceCents: promoProduct.priceCents, quantity: 1, addons });
    });
    if (needsChoice.length) setChoiceQueue(needsChoice);
  };
  return <section className="bg-[#221914] py-5 text-[#fffaf3] sm:py-6"><div className="page-shell"><div className="mb-3 flex items-end justify-between sm:mb-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#e9c98f] sm:text-xs">Condições especiais</p><h2 className="mt-1 font-display text-xl font-bold sm:text-2xl">Promoções do MM System Creator</h2></div><Flame className="h-5 w-5 text-[#e9c98f] sm:h-5 sm:w-5" /></div><HorizontalScroller trackClassName="gap-3 pb-2 sm:gap-3">{events.data?.map(event => <button key={`event-${event.id}`} type="button" onClick={() => setOpenEvent(event)} className="group flex min-h-24 w-[230px] shrink-0 overflow-hidden rounded-2xl bg-[#fffaf3] text-left text-[#211812] shadow-lg ring-2 ring-[#e9c98f] transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none sm:min-h-28 sm:w-[300px]"><div className="min-w-0 flex-1 p-3 sm:p-4"><Badge className="border-0 bg-[#e9c98f] text-[9px] font-bold text-[#3a2a12] sm:text-[10px]">EVENTO</Badge><h3 className="mt-2 font-display text-sm font-bold sm:mt-2 sm:text-xl">{event.title}</h3>{event.description && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#695b50] sm:text-xs sm:leading-4">{event.description}</p>}{event.eventDate && <p className="mt-2 text-[10px] font-semibold text-[#8d3e27] sm:mt-2 sm:text-[11px]">{event.eventDate}</p>}<span className="mt-2 block text-[10px] font-bold text-primary sm:mt-2 sm:text-[11px]">Ver detalhes <ArrowRight className="inline h-3 w-3 sm:h-3 sm:w-3" /></span></div>{event.imageUrl && <SmartImage src={event.imageUrl} alt="" className="w-16 object-cover sm:w-24" />}</button>)}{(promotions.data as PromotionRecord[] | undefined)?.map(promotion => <button key={promotion.id} type="button" onClick={() => openPromotion(promotion)} className="group flex min-h-24 w-[230px] shrink-0 overflow-hidden rounded-2xl bg-[#fffaf3] text-left text-[#211812] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#e9c98f] sm:min-h-28 sm:w-[300px]"><div className="min-w-0 flex-1 p-3 sm:p-4"><Badge className="border-0 bg-primary text-[9px] text-white sm:text-[10px]">PROMOÇÃO</Badge><h3 className="mt-2 font-display text-sm font-bold sm:mt-2 sm:text-xl">{promotion.title}</h3><p className="mt-1 text-[10px] leading-4 text-[#695b50] sm:text-xs sm:leading-4">{promotion.description ?? promotion.products.map(product => product.name).join(" + ")}</p><div className="mt-2 flex items-center justify-between gap-3 sm:mt-2"><span className="text-[10px] font-semibold text-[#8d3e27] sm:text-[11px]">{promotion.validDays}</span>{priceDisplay(promotion)}</div><span className="mt-2 block text-[10px] font-bold text-primary sm:mt-2 sm:text-[11px]">{promotion.products.length > 1 ? "Adicionar combo ao carrinho" : "Adicionar ao carrinho"} <ArrowRight className="inline h-3 w-3 sm:h-3 sm:w-3" /></span></div>{promotion.products[0]?.imageUrl && <SmartImage src={promotion.products[0].imageUrl} alt="" className="w-16 object-cover sm:w-24" />}</button>)}</HorizontalScroller></div>{openEvent && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onClick={() => setOpenEvent(null)}><div onClick={event => event.stopPropagation()} className="my-6 w-full max-w-lg overflow-hidden rounded-3xl bg-[#fffaf3] text-[#211812] shadow-2xl">{openEvent.imageUrl && <img src={openEvent.imageUrl} alt="" className="max-h-80 w-full object-cover" />}<div className="p-6"><div className="flex items-start justify-between gap-4"><Badge className="border-0 bg-[#e9c98f] text-[10px] font-bold text-[#3a2a12]">EVENTO</Badge><button onClick={() => setOpenEvent(null)} className="rounded-lg p-1 hover:bg-[#f3eadf]"><X className="h-5 w-5" /></button></div><h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{openEvent.title}</h3>{openEvent.eventDate && <p className="mt-2 text-sm font-semibold text-[#8d3e27]">{openEvent.eventDate}</p>}{openEvent.description && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#4a3d30]">{openEvent.description}</p>}</div></div></div>}<ProductDialog product={choiceQueue[0] ?? null} open={choiceQueue.length > 0} onOpenChange={value => { if (!value) setChoiceQueue(current => current.slice(1)); }} /></section>;
}
