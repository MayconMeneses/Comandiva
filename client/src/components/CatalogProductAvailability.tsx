import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { compressImageFile } from "@/lib/imageCompression";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";
import { ChangeEvent, FormEvent, useState } from "react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Product = {
  id: number; categoryId: number; name: string; description: string | null;
  imageUrl: string | null; priceCents: number; preparationMinutes: number;
  available: boolean; featured: boolean; onPromotion: boolean; sortOrder: number;
};

type EditForm = {
  categoryId: string; name: string; description: string; imageUrl: string;
  price: string; preparationMinutes: string; featured: boolean; onPromotion: boolean; available: boolean;
};

const blankForm: EditForm = { categoryId: "", name: "", description: "", imageUrl: "", price: "", preparationMinutes: "20", featured: false, onPromotion: false, available: true };

export default function CatalogProductAvailability() {
  const utils = trpc.useUtils();
  const catalog = trpc.admin.catalog.useQuery();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<EditForm>(blankForm);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<number>>(() => new Set());
  const toggleCategory = (categoryId: number) => setOpenCategoryIds(current => {
    const next = new Set(current);
    if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
    return next;
  });

  const refresh = () => { void utils.admin.catalog.invalidate(); void utils.catalog.list.invalidate(); };
  const availability = trpc.admin.setProductAvailability.useMutation({ onSuccess: refresh });
  const save = trpc.admin.saveProduct.useMutation({ onSuccess: () => { setEditing(null); toast.success("Produto atualizado com sucesso."); refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deleteProduct.useMutation({ onSuccess: () => { toast.success("Produto removido do cardápio."); refresh(); }, onError: error => toast.error(error.message) });
  const upload = trpc.admin.uploadProductImage.useMutation({
    onSuccess: data => { setForm(current => ({ ...current, imageUrl: data.url })); setFileName(data.filename); setUploadError(""); },
  });

  const beginEdit = (product: Product) => {
    setEditing(product);
    setForm({
      categoryId: String(product.categoryId), name: product.name, description: product.description ?? "",
      imageUrl: product.imageUrl ?? "", price: (product.priceCents / 100).toFixed(2).replace(".", ","),
      preparationMinutes: String(product.preparationMinutes), featured: product.featured, onPromotion: product.onPromotion, available: product.available,
    });
    setFileName(""); setUploadError("");
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!allowed.includes(file.type) || file.size > 20_000_000) {
      setUploadError("Escolha JPG, PNG, WEBP ou AVIF de até 20 MB."); event.target.value = ""; return;
    }
    void compressImageFile(file).then(({ base64, contentType }) => {
      upload.mutate({ filename: file.name, contentType: contentType as "image/jpeg" | "image/png" | "image/webp" | "image/avif", dataBase64: base64 });
    });
  };

  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    save.mutate({
      id: editing.id, categoryId: Number(form.categoryId), name: form.name, description: form.description || undefined,
      imageUrl: form.imageUrl || undefined, priceCents: Math.round(Number(form.price.replace(",", ".")) * 100),
      preparationMinutes: Number(form.preparationMinutes), available: form.available, featured: form.featured, onPromotion: form.onPromotion, sortOrder: editing.sortOrder,
    });
  };

  if (!catalog.data) return null;

  return (
    <section className="mt-7">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Catálogo público</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-[#231d18]">Cardápio e disponibilidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use <strong>Editar</strong> para alterar informações, preço ou imagem. Use <strong>Excluir</strong> para retirar o item do cardápio preservando pedidos antigos.</p>
      </div>

      <div className="space-y-3">
        {catalog.data.categories.map(category => {
          const categoryProducts = catalog.data.products.filter(product => product.categoryId === category.id);
          const isOpen = openCategoryIds.has(category.id);
          return (
            <section key={category.id} className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
              <button type="button" onClick={() => toggleCategory(category.id)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[#f6ede0]">
                <div className="min-w-0"><h3 className="font-display text-2xl font-bold">{category.name}</h3><p className="text-sm text-muted-foreground">{category.description}</p></div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant="outline" className="rounded-full">{categoryProducts.length} itens</Badge>
                  <ChevronDown className={`h-5 w-5 text-[#8a5c3f] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>
              <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <div className="grid gap-3 border-t border-[#eee5d9] p-4 pt-4 lg:grid-cols-2">
                    {categoryProducts.map(product => (
                      <article key={product.id} className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#e5d8c7]">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2"><p className="font-semibold">{product.name}</p><strong className="shrink-0 text-sm text-[#b4472d]">{money(product.priceCents)}</strong></div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{product.description}</p>
                          </div>
                        </div>
                        <div className="mt-3 border-t border-[#eee5d9] pt-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2"><Switch checked={product.available} onCheckedChange={available => availability.mutate({ productId: product.id, available })} aria-label={`Alternar disponibilidade de ${product.name}`} /><span className={`text-xs font-semibold ${product.available ? "text-emerald-700" : "text-amber-700"}`}>{product.available ? "No cardápio" : "Fora do cardápio"}</span></div>
                            <span className="text-[11px] text-muted-foreground">{[product.featured ? "Em destaque" : "", product.onPromotion ? "Em promoção" : ""].filter(Boolean).join(" · ")}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => beginEdit(product)} className="h-9 min-w-0 rounded-lg border-[#d7c5af] bg-white px-2 text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
                            <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Excluir “${product.name}” do cardápio? Os pedidos antigos serão preservados.`)) remove.mutate({ productId: product.id }); }} className="h-9 min-w-0 rounded-lg border-red-200 bg-white px-2 text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!categoryProducts.length ? <p className="text-sm text-muted-foreground lg:col-span-2">Nenhum produto nesta categoria ainda.</p> : null}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {remove.error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{remove.error.message}</p> : null}

      {editing ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submitEdit} className="my-6 w-full max-w-xl rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4472d]">Manutenção de produto</p><h2 className="mt-1 font-display text-3xl font-bold">Editar {editing.name}</h2></div><Button type="button" variant="ghost" onClick={() => setEditing(null)} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button></div>
            <div className="mt-6 grid gap-4">
              <div><Label>Categoria</Label><select required value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-[#fffdfa] px-3 text-sm">{catalog.data.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
              <div className="grid gap-4 sm:grid-cols-2"><div><Label>Nome</Label><Input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#fffdfa]" /></div><div><Label>Preço (R$)</Label><Input required inputMode="decimal" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#fffdfa]" /></div></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1.5 min-h-20 rounded-xl bg-[#fffdfa]" /></div>
              <div><Label>Tempo de preparo (minutos)</Label><Input required type="number" min="1" value={form.preparationMinutes} onChange={event => setForm({ ...form, preparationMinutes: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-[#fffdfa]" /></div>
              <div className="grid gap-3 rounded-2xl border border-[#e5d9ca] bg-[#fffaf4] p-4"><div><Label>URL da imagem</Label><Input value={form.imageUrl} onChange={event => { setForm({ ...form, imageUrl: event.target.value }); setFileName(""); }} placeholder="https://… ou /assets/pubx/…" className="mt-1.5 h-11 rounded-xl bg-white" /></div><div><Label>Ou importar nova imagem</Label><label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#cdae90] bg-white p-3 text-sm font-semibold text-[#724d3c] hover:border-[#b4472d]"><ImagePlus className="h-4 w-4" />{upload.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando…</> : fileName || "Importar imagem do dispositivo"}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={chooseFile} /></label><p className="mt-1.5 text-xs text-[#806a5a]">JPG, PNG, WEBP ou AVIF de até 20 MB.</p></div>{form.imageUrl ? <img src={form.imageUrl} alt="Prévia do produto" className="h-28 w-full rounded-xl object-cover" /> : null}{uploadError || upload.error ? <p className="text-sm text-red-700">{uploadError || upload.error?.message}</p> : null}</div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.available} onChange={event => setForm({ ...form, available: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Exibir no cardápio</label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Destacar produto</label><label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={form.onPromotion} onChange={event => setForm({ ...form, onPromotion: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Em promoção (aparece também na categoria "Promoção", em primeiro lugar)</label></div>
            </div>
            {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
            <Button disabled={save.isPending || upload.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{save.isPending ? "Salvando alterações…" : "Salvar alterações"}</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
