import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Percent, Plus, Tags, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type Category = { id: number; name: string; notes: string | null; csosn: string | null; cst: string | null; icmsRateBasisPoints: number | null; pisRateBasisPoints: number | null; cofinsRateBasisPoints: number | null; cfop: string | null; active: boolean };

const emptyForm = { name: "", notes: "", csosn: "", cst: "", icmsRate: "", pisRate: "", cofinsRate: "", cfop: "" };

/** Converte "18,00" (%) <-> 1800 (pontos-base) — só formatação, nenhum cálculo tributário. */
function rateToBasisPoints(text: string): number | undefined {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : undefined;
}
function basisPointsToRateText(value: number | null): string {
  return value == null ? "" : (value / 100).toFixed(2).replace(".", ",");
}

export default function FiscalTaxCategories() {
  const utils = trpc.useUtils();
  const query = trpc.admin.fiscalTaxCategories.useQuery();
  const catalog = trpc.admin.catalog.useQuery();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => { void utils.admin.fiscalTaxCategories.invalidate(); };
  const save = trpc.admin.saveFiscalTaxCategory.useMutation({ onSuccess: () => { toast.success(editing ? "Categoria atualizada." : "Categoria criada."); setEditing(null); setCreating(false); setForm(emptyForm); refresh(); }, onError: error => toast.error(error.message) });
  const deactivate = trpc.admin.deactivateFiscalTaxCategory.useMutation({ onSuccess: () => { toast.success("Categoria desativada."); refresh(); }, onError: error => toast.error(error.message) });
  const assignProduct = trpc.admin.assignProductFiscalCategory.useMutation({ onSuccess: () => { void utils.admin.catalog.invalidate(); refresh(); }, onError: error => toast.error(error.message) });

  const beginEdit = (category: Category) => {
    setEditing(category);
    setCreating(false);
    setForm({ name: category.name, notes: category.notes ?? "", csosn: category.csosn ?? "", cst: category.cst ?? "", icmsRate: basisPointsToRateText(category.icmsRateBasisPoints), pisRate: basisPointsToRateText(category.pisRateBasisPoints), cofinsRate: basisPointsToRateText(category.cofinsRateBasisPoints), cfop: category.cfop ?? "" });
  };
  const beginCreate = () => { setCreating(true); setEditing(null); setForm(emptyForm); };
  const close = () => { setEditing(null); setCreating(false); setForm(emptyForm); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({
      id: editing?.id,
      name: form.name,
      notes: form.notes || undefined,
      csosn: form.csosn || undefined,
      cst: form.cst || undefined,
      icmsRateBasisPoints: rateToBasisPoints(form.icmsRate),
      pisRateBasisPoints: rateToBasisPoints(form.pisRate),
      cofinsRateBasisPoints: rateToBasisPoints(form.cofinsRate),
      cfop: form.cfop || undefined,
      active: true,
    });
  };

  const categories = query.data?.categories ?? [];
  const products = (catalog.data?.products ?? []) as Array<{ id: number; name: string; fiscalCategoryId: number | null }>;

  return (
    <section className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-6">
      <div className="flex items-center gap-2"><Tags className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Categorias fiscais</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">Agrupe o cardápio por tratamento tributário (ex.: "Alimentação preparada", "Bebidas"). Preencha CST/CSOSN e alíquota só com os números que o contador confirmar — nenhum valor aqui foi calculado ou sugerido pelo sistema.</p>

      {query.data && query.data.productsWithoutCategory > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />{query.data.productsWithoutCategory} produto(s) do cardápio ainda sem categoria fiscal.
        </div>
      )}

      <div className="mt-4 space-y-2">
        {categories.map(category => (
          <div key={category.id} className={`rounded-xl border p-3 ${category.active ? "border-[#e7dbcc] bg-white" : "border-stone-200 bg-stone-50 opacity-60"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{category.name}{!category.active && <span className="ml-2 text-xs font-normal text-muted-foreground">(desativada)</span>}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  <span>CSOSN: {category.csosn || "—"}</span>
                  <span>CST: {category.cst || "—"}</span>
                  <span>ICMS: {category.icmsRateBasisPoints != null ? `${basisPointsToRateText(category.icmsRateBasisPoints)}%` : "—"}</span>
                  <span>CFOP: {category.cfop || "—"}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => beginEdit(category)} className="h-8 px-2 text-xs">Editar</Button>
                {category.active && <Button type="button" variant="ghost" size="sm" disabled={deactivate.isPending} onClick={() => { if (window.confirm(`Desativar "${category.name}"? Produtos já vinculados continuam com o vínculo, só não aparece mais como opção pra novos produtos.`)) deactivate.mutate({ id: category.id }); }} className="h-8 px-2 text-xs text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>}
              </div>
            </div>
          </div>
        ))}
        {!categories.length && <p className="rounded-xl border border-dashed border-[#d9cdbc] p-4 text-sm text-muted-foreground">Nenhuma categoria fiscal cadastrada ainda.</p>}
      </div>

      {!creating && !editing && <Button type="button" variant="outline" onClick={beginCreate} className="mt-3 h-9 rounded-lg border-[#d8c7b0] bg-white text-xs"><Plus className="mr-1.5 h-3.5 w-3.5" />Nova categoria fiscal</Button>}

      {(creating || editing) && (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-[#e2d5c5] bg-[#fbf6ee] p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between"><p className="font-semibold">{editing ? `Editar "${editing.name}"` : "Nova categoria fiscal"}</p><Button type="button" variant="ghost" onClick={close} className="h-8 text-xs">Cancelar</Button></div>
          <div className="sm:col-span-2"><Label>Nome</Label><Input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Alimentação preparada" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>CSOSN (Simples Nacional)</Label><Input value={form.csosn} onChange={event => setForm({ ...form, csosn: event.target.value })} placeholder="Ex.: 102" maxLength={3} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>CST (demais regimes)</Label><Input value={form.cst} onChange={event => setForm({ ...form, cst: event.target.value })} placeholder="Ex.: 00" maxLength={2} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>Alíquota ICMS (%)</Label><Input value={form.icmsRate} onChange={event => setForm({ ...form, icmsRate: event.target.value })} placeholder="Ex.: 18,00" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>CFOP</Label><Input value={form.cfop} onChange={event => setForm({ ...form, cfop: event.target.value })} placeholder="Ex.: 5102" maxLength={4} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>Alíquota PIS (%)</Label><Input value={form.pisRate} onChange={event => setForm({ ...form, pisRate: event.target.value })} placeholder="Opcional" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div><Label>Alíquota COFINS (%)</Label><Input value={form.cofinsRate} onChange={event => setForm({ ...form, cofinsRate: event.target.value })} placeholder="Opcional" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
          <div className="sm:col-span-2"><Label>Notas (opcional)</Label><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Ex.: confirmado com o contador em 10/2026" className="mt-1.5 min-h-16 rounded-xl bg-white" /></div>
          {save.error && <p className="sm:col-span-2 text-sm text-red-700">{save.error.message}</p>}
          <Button disabled={save.isPending} className="sm:col-span-2 h-10 rounded-xl bg-primary hover:bg-primary-hover"><Percent className="mr-1.5 h-4 w-4" />{save.isPending ? "Salvando…" : "Salvar categoria"}</Button>
        </form>
      )}

      {categories.length > 0 && (
        <div className="mt-6 border-t border-[#eee4d8] pt-4">
          <h3 className="font-semibold">Produtos do cardápio</h3>
          <p className="mt-1 text-xs text-muted-foreground">Vincule cada produto à categoria fiscal certa.</p>
          <div className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
            {products.map(product => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#eee4d8] bg-white px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <select
                  value={product.fiscalCategoryId ?? ""}
                  onChange={event => assignProduct.mutate({ productId: product.id, fiscalCategoryId: event.target.value ? Number(event.target.value) : null })}
                  className="h-8 shrink-0 rounded-lg border border-input bg-white px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="">Sem categoria</option>
                  {categories.filter(category => category.active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
