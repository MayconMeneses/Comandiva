import { Input } from "@/components/ui/input";
import SmartImage from "@/components/SmartImage";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** Busca de produto por nome/categoria, reaproveitada onde a equipe ou o cliente monta um pedido fora do cardápio visual (balcão, mesa). */
export default function ProductSearch({ onSelect }: { onSelect: (product: MenuProduct) => void }) {
  const [search, setSearch] = useState("");
  const catalog = trpc.catalog.list.useQuery();
  const allProducts = useMemo(() => (catalog.data ?? []).flatMap(category => category.products.map(product => ({ ...product, categoryName: category.name }))), [catalog.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return allProducts;
    return allProducts.filter(product => product.name.toLowerCase().includes(term) || product.categoryName.toLowerCase().includes(term));
  }, [allProducts, search]);
  return <div>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar produto pelo nome…" className="h-10 rounded-xl pl-9" /></div>
    <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#e4d8c8] bg-white p-1.5">
      {filtered.length ? filtered.map(product => <button type="button" key={product.id} disabled={!product.available} onClick={() => onSelect(product)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-[#f6ede0] disabled:cursor-not-allowed disabled:opacity-50"><span className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[#eee1d2]"><SmartImage src={product.imageUrl} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}{!product.available ? " (indisponível)" : ""}</span><span className="block text-xs text-muted-foreground">{product.categoryName}</span></span><span className="shrink-0 text-sm font-semibold text-[#b4472d]">{money(product.priceCents)}</span></button>) : <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</p>}
    </div>
  </div>;
}
