import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SmartImage from "@/components/SmartImage";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loading } from "./shared";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type PromotionObjective = "INCREASE_SALES" | "INCREASE_AVERAGE_TICKET" | "ATTRACT_NEW_CUSTOMERS" | "BOOST_LOW_DAY" | "BOOST_LOW_HOUR" | "BOOST_DELIVERY" | "REDUCE_STOCK" | "PROMOTE_PRODUCT" | "LOYALTY";

const OBJECTIVE_LABELS: Record<PromotionObjective, string> = {
  INCREASE_SALES: "Aumentar vendas",
  INCREASE_AVERAGE_TICKET: "Aumentar ticket médio",
  ATTRACT_NEW_CUSTOMERS: "Atrair novos clientes",
  BOOST_LOW_DAY: "Estimular dia de baixa",
  BOOST_LOW_HOUR: "Estimular horário de baixa",
  BOOST_DELIVERY: "Aumentar pedidos de delivery",
  REDUCE_STOCK: "Reduzir estoque",
  PROMOTE_PRODUCT: "Divulgar produto",
  LOYALTY: "Fidelizar clientes",
};

type CatalogProduct = { id: number; name: string; imageUrl: string | null; priceCents: number; categoryId: number };
type CatalogCategory = { id: number; name: string };
type CatalogAddonGroup = { id: number; productId: number; name: string; minSelections: number; maxSelections: number };
type CatalogAddonOption = { id: number; groupId: number; name: string; priceCents: number; available: boolean };
type PromotionAddonDefault = { mode: "ADMIN_DEFAULT" | "CUSTOMER_CHOICE"; defaultOptionId: number | null };
type PromotionLinkedProduct = CatalogProduct & { addonGroups: Array<CatalogAddonGroup & { options: CatalogAddonOption[]; promotionDefault: PromotionAddonDefault | null }> };
type Promotion = { id: number; title: string; description: string | null; promoPriceCents: number | null; objective: PromotionObjective | null; validDays: string | null; active: boolean; sortOrder: number; products: PromotionLinkedProduct[] };
type AddonDefaultKey = `${number}-${number}`;
type Form = { title: string; description: string; promoPriceCents: string; objective: PromotionObjective | ""; validDays: string; productIds: number[]; active: boolean; addonDefaults: Record<AddonDefaultKey, PromotionAddonDefault> };
const blank: Form = { title: "", description: "", promoPriceCents: "", objective: "", validDays: "", productIds: [], active: true, addonDefaults: {} };
const addonKey = (productId: number, groupId: number): AddonDefaultKey => `${productId}-${groupId}`;

function ProductPicker({ products, categories, selectedIds, onToggle }: { products: CatalogProduct[]; categories: CatalogCategory[]; selectedIds: number[]; onToggle: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const categoryName = (categoryId: number) => categories.find(category => category.id === categoryId)?.name ?? "";
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(product => product.name.toLowerCase().includes(term) || categoryName(product.categoryId).toLowerCase().includes(term));
  }, [products, search, categories]);
  return <div>
    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar produto do cardápio…" className="h-10 rounded-xl pl-9" /></div>
    <div className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-1.5">
      {filtered.length ? filtered.map(product => { const checked = selectedIds.includes(product.id); return <label key={product.id} className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left ${checked ? "bg-[#fdf1eb] ring-1 ring-primary" : "hover:bg-[#f6ede0]"}`}><input type="checkbox" checked={checked} onChange={() => onToggle(product.id)} className="h-4 w-4 accent-primary" /><span className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[#eee1d2]"><SmartImage src={product.imageUrl} alt="" className="h-full w-full object-cover" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.name}</span><span className="block text-xs text-muted-foreground">{categoryName(product.categoryId)}</span></span><span className="shrink-0 text-sm font-semibold text-primary">{money(product.priceCents)}</span></label>; }) : <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum produto encontrado.</p>}
    </div>
    <p className="mt-1.5 text-xs text-muted-foreground">{selectedIds.length === 0 ? "Escolha ao menos um produto." : selectedIds.length === 1 ? "1 produto escolhido." : `${selectedIds.length} produtos escolhidos (combo).`}</p>
  </div>;
}

export default function PromotionManager() {
  const utils = trpc.useUtils();
  const query = trpc.admin.promotions.useQuery();
  const catalog = trpc.admin.catalog.useQuery();
  const [sectionOpen, setSectionOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const refresh = () => { void utils.admin.promotions.invalidate(); void utils.catalog.promotions.invalidate(); };
  const save = trpc.admin.savePromotion.useMutation({ onSuccess: () => { toast.success(editing ? "Promoção atualizada." : "Promoção criada."); setEditing(null); setCreating(false); refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deletePromotion.useMutation({ onSuccess: () => { toast.success("Promoção apagada."); refresh(); }, onError: error => toast.error(error.message) });

  if (query.isLoading || !query.data) return <Loading />;
  const products = (catalog.data?.products ?? []) as CatalogProduct[];
  const categories = (catalog.data?.categories ?? []) as CatalogCategory[];
  const addonGroupRows = (catalog.data?.addonGroups ?? []) as CatalogAddonGroup[];
  const addonOptionRows = (catalog.data?.addonOptions ?? []) as CatalogAddonOption[];
  const promotions = query.data as unknown as Promotion[];
  // Grupos de adicional obrigatório (minSelections > 0) do produto — só esses
  // precisam de uma resolução pra não travar o "adicionar combo com 1 clique".
  const requiredGroupsFor = (productId: number) => addonGroupRows.filter(group => group.productId === productId && group.minSelections > 0).map(group => ({ ...group, options: addonOptionRows.filter(option => option.groupId === group.id) }));

  const beginEdit = (promotion: Promotion) => {
    setEditing(promotion);
    const addonDefaults: Form["addonDefaults"] = {};
    for (const product of promotion.products) for (const group of product.addonGroups) if (group.promotionDefault) addonDefaults[addonKey(product.id, group.id)] = group.promotionDefault;
    setForm({ title: promotion.title, description: promotion.description ?? "", promoPriceCents: promotion.promoPriceCents != null ? String(promotion.promoPriceCents / 100).replace(".", ",") : "", objective: promotion.objective ?? "", validDays: promotion.validDays ?? "", productIds: promotion.products.map(product => product.id), active: promotion.active, addonDefaults });
  };
  const beginCreate = () => { setCreating(true); setForm(blank); };
  const close = () => { setEditing(null); setCreating(false); };
  const toggleProduct = (id: number) => setForm(current => ({ ...current, productIds: current.productIds.includes(id) ? current.productIds.filter(productId => productId !== id) : [...current.productIds, id] }));
  const setAddonDefault = (productId: number, groupId: number, value: PromotionAddonDefault) => setForm(current => ({ ...current, addonDefaults: { ...current.addonDefaults, [addonKey(productId, groupId)]: value } }));

  const normalTotalCents = form.productIds.reduce((sum, id) => sum + (products.find(product => product.id === id)?.priceCents ?? 0), 0);
  const promoCents = form.promoPriceCents ? Math.round(Number(form.promoPriceCents.replace(",", ".")) * 100) : null;
  const discountPct = promoCents !== null && normalTotalCents > 0 && promoCents < normalTotalCents ? Math.round((1 - promoCents / normalTotalCents) * 100) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const addonDefaults = form.productIds.flatMap(productId => requiredGroupsFor(productId).map(group => {
      const config = form.addonDefaults[addonKey(productId, group.id)] ?? { mode: "CUSTOMER_CHOICE" as const, defaultOptionId: null };
      return { productId, addonGroupId: group.id, mode: config.mode, defaultOptionId: config.defaultOptionId ?? undefined };
    }));
    save.mutate({ id: editing?.id, title: form.title, description: form.description || undefined, promoPriceCents: promoCents ?? undefined, objective: form.objective || undefined, validDays: form.validDays || undefined, productIds: form.productIds, addonDefaults, active: form.active, sortOrder: editing?.sortOrder ?? promotions.length + 1 });
  };

  return <section className="mt-10 border-t border-[#ddcfbd] pt-10">
    <button type="button" onClick={() => setSectionOpen(current => !current)} aria-expanded={sectionOpen} className="flex w-full items-center justify-between gap-4 rounded-2xl py-1 text-left transition-colors hover:bg-[#f6ede0]/40"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Vitrine</p><h2 className="mt-2 font-display text-3xl font-bold">Promoções</h2></div><ChevronDown className={`h-6 w-6 shrink-0 text-[#8a5c3f] transition-transform duration-300 ${sectionOpen ? "rotate-180" : ""}`} /></button>
    <div className={`grid transition-all duration-300 ease-in-out ${sectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><div className="pt-5">
      <div className="mb-5 flex items-end justify-between gap-4"><p className="max-w-xl text-sm text-muted-foreground">Promoções sempre usam produtos reais do cardápio — escolha um só produto ou vários (combo). A imagem e o preço normal vêm automaticamente do produto.</p><Button onClick={beginCreate} className="shrink-0 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-1.5 h-4 w-4" />Nova promoção</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {promotions.map(promotion => { const normalTotal = promotion.products.reduce((sum, product) => sum + product.priceCents, 0); const discount = promotion.promoPriceCents != null && normalTotal > 0 ? Math.round((1 - promotion.promoPriceCents / normalTotal) * 100) : null; const cover = promotion.products[0]?.imageUrl; return <article key={promotion.id} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex gap-3 p-4">
            <span className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#eee1d2]"><SmartImage src={cover} alt="" className="h-full w-full object-cover" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2"><p className="font-semibold">{promotion.title}</p><Badge variant="outline" className={`shrink-0 rounded-full ${promotion.active ? "" : "border-amber-300 text-amber-700"}`}>{promotion.active ? "Ativa" : "Inativa"}</Badge></div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{promotion.products.map(product => product.name).join(" + ") || "Nenhum produto vinculado"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                {normalTotal > 0 && <span className="text-muted-foreground line-through">{money(normalTotal)}</span>}
                {promotion.promoPriceCents != null && <strong className="text-primary">{money(promotion.promoPriceCents)}</strong>}
                {discount !== null && discount > 0 && <span className="text-xs font-semibold text-emerald-700">-{discount}%</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{[promotion.validDays, promotion.objective ? OBJECTIVE_LABELS[promotion.objective] : null].filter(Boolean).join(" · ") || "Sem validade/objetivo definidos"}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(promotion)} className="h-9 rounded-lg border-[#d7c5af] bg-card text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
            <Button type="button" size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Apagar a promoção "${promotion.title}"?`)) remove.mutate({ id: promotion.id }); }} className="h-9 rounded-lg border-red-200 bg-card text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Apagar</Button>
          </div>
        </article>; })}
        {!promotions.length ? <p className="text-sm text-muted-foreground">Nenhuma promoção cadastrada ainda.</p> : null}
      </div>
    </div></div></div>
    {(editing || creating) ? <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4"><form onSubmit={submit} className="my-6 w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{editing ? "Editar" : "Nova"}</p><h2 className="mt-1 font-display text-2xl font-bold">Promoção</h2></div><Button type="button" variant="ghost" onClick={close} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button></div>
      <div className="mt-5 space-y-4">
        <Input required autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Título da promoção" className="h-10 rounded-xl" />
        <Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Descrição e condições" className="min-h-20 rounded-xl" />
        <div><Label>Produto(s) do cardápio</Label><div className="mt-1.5"><ProductPicker products={products} categories={categories} selectedIds={form.productIds} onToggle={toggleProduct} /></div></div>
        {form.productIds.map(productId => {
          const groups = requiredGroupsFor(productId);
          if (!groups.length) return null;
          const productName = products.find(product => product.id === productId)?.name ?? "";
          return <div key={productId} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">{productName} tem adicional obrigatório — quem escolhe?</p>
            {groups.map(group => {
              const current = form.addonDefaults[addonKey(productId, group.id)] ?? { mode: "CUSTOMER_CHOICE" as const, defaultOptionId: null };
              return <div key={group.id} className="mt-2 rounded-lg bg-card/70 p-2.5">
                <p className="text-xs font-medium">{group.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs"><input type="radio" name={`addon-${productId}-${group.id}`} checked={current.mode === "CUSTOMER_CHOICE"} onChange={() => setAddonDefault(productId, group.id, { mode: "CUSTOMER_CHOICE", defaultOptionId: null })} className="accent-primary" />Cliente escolhe ao adicionar</label>
                  <label className="flex items-center gap-1.5 text-xs"><input type="radio" name={`addon-${productId}-${group.id}`} checked={current.mode === "ADMIN_DEFAULT"} onChange={() => setAddonDefault(productId, group.id, { mode: "ADMIN_DEFAULT", defaultOptionId: current.defaultOptionId ?? group.options[0]?.id ?? null })} className="accent-primary" />Sempre usar:</label>
                  {current.mode === "ADMIN_DEFAULT" && <select value={current.defaultOptionId ?? ""} onChange={event => setAddonDefault(productId, group.id, { mode: "ADMIN_DEFAULT", defaultOptionId: Number(event.target.value) })} className="h-8 rounded-lg border bg-card px-2 text-xs">{group.options.filter(option => option.available).map(option => <option key={option.id} value={option.id}>{option.name}{option.priceCents ? ` (+${money(option.priceCents)})` : ""}</option>)}</select>}
                </div>
              </div>;
            })}
          </div>;
        })}
        <div><Label>Preço promocional (R$, opcional)</Label><Input value={form.promoPriceCents} onChange={event => setForm({ ...form, promoPriceCents: event.target.value })} inputMode="decimal" placeholder="Ex.: 29,90" className="mt-1.5 h-10 rounded-xl" />{discountPct !== null && <p className="mt-1 text-xs font-semibold text-emerald-700">-{discountPct}% em relação ao preço normal ({money(normalTotalCents)})</p>}</div>
        <Input value={form.validDays} onChange={event => setForm({ ...form, validDays: event.target.value })} placeholder="Validade, ex.: Ter–Qui" className="h-10 rounded-xl" />
        <select value={form.objective} onChange={event => setForm({ ...form, objective: event.target.value as PromotionObjective | "" })} className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option value="">Objetivo (opcional)</option>{Object.entries(OBJECTIVE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-primary" />Exibir agora no cardápio</label>
      </div>
      {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
      <Button disabled={save.isPending} className="mt-6 h-11 w-full rounded-xl bg-primary hover:bg-primary-hover">{save.isPending ? "Salvando…" : "Salvar promoção"}</Button>
    </form></div> : null}
  </section>;
}
