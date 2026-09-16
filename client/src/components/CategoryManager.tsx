import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { compressImageFile } from "@/lib/imageCompression";
import { defaultCategoryIcon } from "@/lib/categoryIcons";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type Category = { id: number; name: string; description: string | null; imageUrl: string | null; timeAvailability: string; active: boolean; sortOrder: number };
type Form = { name: string; description: string; imageUrl: string; timeAvailability: string; active: boolean };
const blank: Form = { name: "", description: "", imageUrl: "", timeAvailability: "ALWAYS", active: true };

const TIME_AVAILABILITY_LABELS: Record<string, string> = {
  ALWAYS: "Sempre disponível",
  LUNCH: "Só no horário de almoço",
  DINNER: "Só no horário de janta",
  LUNCH_AND_DINNER: "Almoço e janta",
};

function LunchDinnerHours() {
  const utils = trpc.useUtils();
  const dashboard = trpc.admin.dashboard.useQuery();
  const settings = dashboard.data?.settings;
  const [form, setForm] = useState(() => ({ lunchStartTime: settings?.lunchStartTime ?? "10:00", lunchEndTime: settings?.lunchEndTime ?? "15:00", dinnerStartTime: settings?.dinnerStartTime ?? "16:00", dinnerEndTime: settings?.dinnerEndTime ?? "23:59" }));
  const update = trpc.admin.updateSettings.useMutation({ onSuccess: () => { toast.success("Horários salvos."); void utils.admin.dashboard.invalidate(); void utils.catalog.list.invalidate(); }, onError: error => toast.error(error.message) });
  if (!settings) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ isAcceptingOrders: settings.isAcceptingOrders, deliveryFeeCents: settings.deliveryFeeCents, minimumOrderCents: settings.minimumOrderCents, estimatedDeliveryMin: settings.estimatedDeliveryMin, estimatedDeliveryMax: settings.estimatedDeliveryMax, openingHours: settings.openingHours ?? "", ...form });
  };
  return (
    <section className="mb-8 rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Cardápio por horário</p>
      <h3 className="mt-1 font-display text-xl font-bold">Janelas de almoço e janta</h3>
      <p className="mt-1 text-sm text-muted-foreground">Usadas por categorias marcadas como "Só no almoço", "Só na janta" ou "Almoço e janta". Deixe em branco para não restringir por horário.</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-dashed border-[#d8c7b0] p-3">
          <p className="text-xs font-semibold text-[#8a5c3f]">Almoço</p>
          <div className="mt-2 flex items-center gap-2">
            <Input type="time" value={form.lunchStartTime} onChange={event => setForm({ ...form, lunchStartTime: event.target.value })} className="h-10 rounded-lg bg-white" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="time" value={form.lunchEndTime} onChange={event => setForm({ ...form, lunchEndTime: event.target.value })} className="h-10 rounded-lg bg-white" />
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-[#d8c7b0] p-3">
          <p className="text-xs font-semibold text-[#8a5c3f]">Janta</p>
          <div className="mt-2 flex items-center gap-2">
            <Input type="time" value={form.dinnerStartTime} onChange={event => setForm({ ...form, dinnerStartTime: event.target.value })} className="h-10 rounded-lg bg-white" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="time" value={form.dinnerEndTime} onChange={event => setForm({ ...form, dinnerEndTime: event.target.value })} className="h-10 rounded-lg bg-white" />
          </div>
        </div>
        <Button disabled={update.isPending} className="h-10 w-fit rounded-xl bg-primary px-5 hover:bg-primary-hover sm:col-span-2">{update.isPending ? "Salvando…" : "Salvar horários"}</Button>
      </form>
    </section>
  );
}

export default function CategoryManager() {
  const utils = trpc.useUtils();
  const catalog = trpc.admin.catalog.useQuery();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const refresh = () => { void utils.admin.catalog.invalidate(); void utils.catalog.list.invalidate(); };
  const save = trpc.admin.saveCategory.useMutation({
    onSuccess: () => { toast.success(editing ? "Categoria atualizada." : "Categoria criada."); setEditing(null); setCreating(false); setForm(blank); refresh(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.deleteCategory.useMutation({
    onSuccess: () => { toast.success("Categoria excluída."); refresh(); },
    onError: error => toast.error(error.message),
  });
  const uploadImage = trpc.admin.uploadCategoryImage.useMutation({ onSuccess: result => setForm(current => ({ ...current, imageUrl: result.url })) });

  if (!catalog.data) return null;
  const categories = catalog.data.categories as Category[];
  const productCountFor = (categoryId: number) => catalog.data.products.filter(product => product.categoryId === categoryId).length;

  const beginEdit = (category: Category) => { setEditing(category); setForm({ name: category.name, description: category.description ?? "", imageUrl: category.imageUrl ?? "", timeAvailability: category.timeAvailability ?? "ALWAYS", active: category.active }); };
  const beginCreate = () => { setCreating(true); setForm(blank); };
  const close = () => { setEditing(null); setCreating(false); };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20_000_000) {
      toast.error("Escolha uma imagem de até 20 MB.");
      return;
    }
    void compressImageFile(file).then(({ base64, contentType }) => {
      uploadImage.mutate({ filename: file.name, contentType: contentType as "image/jpeg" | "image/png" | "image/webp", dataBase64: base64 });
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: editing?.id, name: form.name, description: form.description || undefined, imageUrl: form.imageUrl || undefined, timeAvailability: form.timeAvailability as never, active: form.active, sortOrder: editing?.sortOrder ?? categories.length + 1 });
  };

  return (
    <section className="mt-10 border-t border-[#ddcfbd] pt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Organização</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Categorias</h2>
          <p className="mt-1 text-sm text-muted-foreground">Crie, edite ou apague categorias do cardápio. Uma categoria com produtos não pode ser apagada.</p>
        </div>
        <Button onClick={beginCreate} className="shrink-0 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-1.5 h-4 w-4" />Nova categoria</Button>
      </div>

      <LunchDinnerHours />

      <div className="grid gap-3 md:grid-cols-2">
        {categories.map(category => (
          <article key={category.id} className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
            <div className="flex items-start gap-3">
              <img src={category.imageUrl || defaultCategoryIcon(category.name)} alt="" className="h-12 w-12 shrink-0 rounded-full border border-[#e4d8c8] bg-white object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{category.name}</p>
                  <Badge variant="outline" className={`shrink-0 rounded-full ${category.active ? "" : "border-amber-300 text-amber-700"}`}>{category.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                {category.description ? <p className="mt-1 truncate text-xs text-muted-foreground">{category.description}</p> : null}
                <p className="mt-1 text-[11px] font-medium text-[#8a5c3f]">{TIME_AVAILABILITY_LABELS[category.timeAvailability] ?? "Sempre disponível"}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{productCountFor(category.id)} itens</span>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(category)} className="h-9 rounded-lg border-[#d7c5af] bg-white text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
                <Button type="button" size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Apagar a categoria "${category.name}"?`)) remove.mutate({ categoryId: category.id }); }} className="h-9 rounded-lg border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Apagar</Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {(editing || creating) ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submit} className="my-6 w-full max-w-md rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{editing ? "Editar" : "Nova"}</p><h2 className="mt-1 font-display text-2xl font-bold">{editing ? editing.name : "Nova categoria"}</h2></div>
              <Button type="button" variant="ghost" onClick={close} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div><Label>Nome</Label><Input required autoFocus value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Descrição</Label><Input value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div>
                <Label>Imagem da categoria</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <img src={form.imageUrl || defaultCategoryIcon(form.name || "categoria")} alt="" className="h-14 w-14 shrink-0 rounded-full border border-[#e4d8c8] bg-white object-cover" />
                  <div className="flex-1">
                    <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleImageFile(event.target.files?.[0])} className="h-10 rounded-xl bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3eadf] file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
                    {uploadImage.isPending && <p className="mt-1 text-xs text-muted-foreground">Enviando imagem…</p>}
                    {uploadImage.error && <p className="mt-1 text-xs text-red-700">{uploadImage.error.message}</p>}
                    {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="mt-1 text-xs font-semibold text-primary hover:underline">Remover e usar ícone padrão</button>}
                  </div>
                </div>
              </div>
              <div>
                <Label>Disponibilidade por horário</Label>
                <select value={form.timeAvailability} onChange={event => setForm({ ...form, timeAvailability: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm">
                  {Object.entries(TIME_AVAILABILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {form.timeAvailability !== "ALWAYS" && <p className="mt-1.5 text-xs text-muted-foreground">Usa as janelas de almoço/janta configuradas acima. Se ficarem em branco, a categoria não é restringida.</p>}
              </div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-primary" />Categoria ativa (visível no cardápio)</label>
            </div>
            {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
            <Button disabled={save.isPending || uploadImage.isPending} className="mt-6 h-11 w-full rounded-xl bg-primary hover:bg-primary-hover">{save.isPending ? "Salvando…" : "Salvar categoria"}</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
