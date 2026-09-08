import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type Group = { id: number; productId: number; name: string; required: boolean; minSelections: number; maxSelections: number; active: boolean; sortOrder: number };
type Option = { id: number; groupId: number; name: string; priceCents: number; available: boolean; sortOrder: number };
type GroupForm = { productId: string; name: string; required: boolean; min: string; max: string; active: boolean };
type OptionForm = { groupId: string; name: string; price: string; available: boolean };

const blankGroup: GroupForm = { productId: "", name: "", required: false, min: "0", max: "2", active: true };
const blankOption: OptionForm = { groupId: "", name: "", price: "0,00", available: true };

export default function AddonManager() {
  const utils = trpc.useUtils();
  const catalog = trpc.admin.catalog.useQuery();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm>(blankGroup);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [creatingOption, setCreatingOption] = useState<{ groupId: number } | null>(null);
  const [optionForm, setOptionForm] = useState<OptionForm>(blankOption);

  const [sectionOpen, setSectionOpen] = useState(false);
  const refresh = () => { void utils.admin.catalog.invalidate(); void utils.catalog.list.invalidate(); };
  const saveGroup = trpc.admin.saveAddonGroup.useMutation({ onSuccess: () => { toast.success(editingGroup ? "Grupo atualizado." : "Grupo criado."); setEditingGroup(null); setCreatingGroup(false); refresh(); }, onError: error => toast.error(error.message) });
  const deleteGroup = trpc.admin.deleteAddonGroup.useMutation({ onSuccess: () => { toast.success("Grupo apagado."); refresh(); }, onError: error => toast.error(error.message) });
  const saveOption = trpc.admin.saveAddonOption.useMutation({ onSuccess: () => { toast.success(editingOption ? "Opção atualizada." : "Opção criada."); setEditingOption(null); setCreatingOption(null); refresh(); }, onError: error => toast.error(error.message) });
  const deleteOption = trpc.admin.deleteAddonOption.useMutation({ onSuccess: () => { toast.success("Opção apagada."); refresh(); }, onError: error => toast.error(error.message) });

  if (!catalog.data) return null;
  const products = catalog.data.products;
  const groups = catalog.data.addonGroups as Group[];
  const options = catalog.data.addonOptions as Option[];
  const productName = (id: number) => products.find(product => product.id === id)?.name ?? "—";

  const beginEditGroup = (group: Group) => { setEditingGroup(group); setGroupForm({ productId: String(group.productId), name: group.name, required: group.required, min: String(group.minSelections), max: String(group.maxSelections), active: group.active }); };
  const beginCreateGroup = () => { setCreatingGroup(true); setGroupForm(blankGroup); };
  const submitGroup = (event: FormEvent) => {
    event.preventDefault();
    saveGroup.mutate({ id: editingGroup?.id, productId: Number(groupForm.productId), name: groupForm.name, required: groupForm.required, minSelections: Number(groupForm.min), maxSelections: Number(groupForm.max), active: groupForm.active, sortOrder: editingGroup?.sortOrder ?? groups.length + 1 });
  };

  const beginEditOption = (option: Option) => { setEditingOption(option); setOptionForm({ groupId: String(option.groupId), name: option.name, price: (option.priceCents / 100).toFixed(2).replace(".", ","), available: option.available }); };
  const beginCreateOption = (groupId: number) => { setCreatingOption({ groupId }); setOptionForm({ ...blankOption, groupId: String(groupId) }); };
  const submitOption = (event: FormEvent) => {
    event.preventDefault();
    saveOption.mutate({ id: editingOption?.id, groupId: Number(optionForm.groupId), name: optionForm.name, priceCents: Math.round(Number(optionForm.price.replace(",", ".")) * 100), available: optionForm.available, sortOrder: editingOption?.sortOrder ?? options.filter(o => o.groupId === Number(optionForm.groupId)).length + 1 });
  };

  return (
    <section className="mt-10 border-t border-[#ddcfbd] pt-10">
      <button type="button" onClick={() => setSectionOpen(current => !current)} aria-expanded={sectionOpen} className="flex w-full items-center justify-between gap-4 rounded-2xl py-1 text-left transition-colors hover:bg-[#f6ede0]/40">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Personalização</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Complementos</h2>
        </div>
        <ChevronDown className={`h-6 w-6 shrink-0 text-[#8a5c3f] transition-transform duration-300 ${sectionOpen ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${sectionOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="pt-5">
            <div className="mb-5 flex items-end justify-between gap-4">
              <p className="text-sm text-muted-foreground">Grupos de escolha (ex.: ponto da carne, tamanho) e suas opções, por produto.</p>
              <Button onClick={beginCreateGroup} className="shrink-0 rounded-xl bg-[#b4472d] hover:bg-[#943722]"><Plus className="mr-1.5 h-4 w-4" />Novo grupo</Button>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
        {groups.map(group => (
          <article key={group.id} className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{group.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{productName(group.productId)} · {group.minSelections}–{group.maxSelections} escolhas</p>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">{group.required ? "Obrigatório" : "Opcional"}{group.active ? "" : " · Inativo"}</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {options.filter(option => option.groupId === group.id).map(option => (
                <span key={option.id} className="flex items-center gap-1.5 rounded-full bg-[#f3eadf] py-1 pl-2.5 pr-1 text-xs font-medium">
                  {option.name}{option.priceCents ? ` + ${money(option.priceCents)}` : ""}
                  <button type="button" onClick={() => beginEditOption(option)} className="rounded-full p-1 hover:bg-[#e7d8c4]" aria-label={`Editar ${option.name}`}><Pencil className="h-3 w-3" /></button>
                  <button type="button" onClick={() => { if (window.confirm(`Apagar a opção "${option.name}"?`)) deleteOption.mutate({ optionId: option.id }); }} className="rounded-full p-1 text-red-700 hover:bg-red-100" aria-label={`Apagar ${option.name}`}><Trash2 className="h-3 w-3" /></button>
                </span>
              ))}
              <button type="button" onClick={() => beginCreateOption(group.id)} className="rounded-full border border-dashed border-[#cdae90] px-2.5 py-1 text-xs font-semibold text-[#8a5c3f] hover:border-[#b4472d] hover:text-[#b4472d]">+ opção</button>
            </div>

            <div className="mt-3 flex justify-end gap-2 border-t border-[#eee5d9] pt-3">
              <Button type="button" size="sm" variant="outline" onClick={() => beginEditGroup(group)} className="h-9 rounded-lg border-[#d7c5af] bg-white text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar grupo</Button>
              <Button type="button" size="sm" variant="outline" disabled={deleteGroup.isPending} onClick={() => { if (window.confirm(`Apagar o grupo "${group.name}" e todas as suas opções?`)) deleteGroup.mutate({ groupId: group.id }); }} className="h-9 rounded-lg border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Apagar grupo</Button>
            </div>
          </article>
        ))}
        {!groups.length ? <p className="text-sm text-muted-foreground">Nenhum grupo de complemento cadastrado ainda.</p> : null}
      </div>
          </div>
        </div>
      </div>

      {(editingGroup || creatingGroup) ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <form onSubmit={submitGroup} className="w-full max-w-md rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4472d]">{editingGroup ? "Editar" : "Novo"}</p><h2 className="mt-1 font-display text-2xl font-bold">{editingGroup ? editingGroup.name : "Novo grupo"}</h2></div>
              <Button type="button" variant="ghost" onClick={() => { setEditingGroup(null); setCreatingGroup(false); }} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div><Label>Produto</Label><select required value={groupForm.productId} onChange={event => setGroupForm({ ...groupForm, productId: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"><option value="">Selecione</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>
              <div><Label>Nome do grupo</Label><Input required autoFocus value={groupForm.name} onChange={event => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Ex.: Ponto da carne" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Mínimo de escolhas</Label><Input required type="number" min="0" value={groupForm.min} onChange={event => setGroupForm({ ...groupForm, min: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div><div><Label>Máximo de escolhas</Label><Input required type="number" min="1" value={groupForm.max} onChange={event => setGroupForm({ ...groupForm, max: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div></div>
              <div className="flex gap-5"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={groupForm.required} onChange={event => setGroupForm({ ...groupForm, required: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Obrigatório</label><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={groupForm.active} onChange={event => setGroupForm({ ...groupForm, active: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Ativo</label></div>
            </div>
            {saveGroup.error ? <p className="mt-4 text-sm text-red-700">{saveGroup.error.message}</p> : null}
            <Button disabled={saveGroup.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{saveGroup.isPending ? "Salvando…" : "Salvar grupo"}</Button>
          </form>
        </div>
      ) : null}

      {(editingOption || creatingOption) ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <form onSubmit={submitOption} className="w-full max-w-sm rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4472d]">{editingOption ? "Editar" : "Nova"}</p><h2 className="mt-1 font-display text-2xl font-bold">{editingOption ? editingOption.name : "Nova opção"}</h2></div>
              <Button type="button" variant="ghost" onClick={() => { setEditingOption(null); setCreatingOption(null); }} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div><Label>Nome da opção</Label><Input required autoFocus value={optionForm.name} onChange={event => setOptionForm({ ...optionForm, name: event.target.value })} placeholder="Ex.: Ao ponto" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Valor adicional (R$)</Label><Input required inputMode="decimal" value={optionForm.price} onChange={event => setOptionForm({ ...optionForm, price: event.target.value })} placeholder="0,00" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={optionForm.available} onChange={event => setOptionForm({ ...optionForm, available: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Disponível</label>
            </div>
            {saveOption.error ? <p className="mt-4 text-sm text-red-700">{saveOption.error.message}</p> : null}
            <Button disabled={saveOption.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{saveOption.isPending ? "Salvando…" : "Salvar opção"}</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
