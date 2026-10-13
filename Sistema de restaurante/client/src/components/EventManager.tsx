import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compressImageFile } from "@/lib/imageCompression";
import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/admin/shared";
import { LockedFeatureFullPage } from "@/components/admin/LockedFeature";
import { CalendarDays, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type Event = { id: number; title: string; description: string | null; imageUrl: string | null; eventDate: string | null; active: boolean; sortOrder: number };
type Form = { title: string; description: string; imageUrl: string; eventDate: string; active: boolean };
const blank: Form = { title: "", description: "", imageUrl: "", eventDate: "", active: true };

export default function EventManager() {
  const utils = trpc.useUtils();
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const locked = snapshot.data?.lockedFeatures.events;
  const query = trpc.admin.events.useQuery(undefined, { enabled: !snapshot.isLoading && !locked });
  const [editing, setEditing] = useState<Event | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const refresh = () => { void utils.admin.events.invalidate(); void utils.catalog.events.invalidate(); };
  const save = trpc.admin.saveEvent.useMutation({ onSuccess: () => { toast.success(editing ? "Evento atualizado." : "Evento criado."); setEditing(null); setCreating(false); refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deleteEvent.useMutation({ onSuccess: () => { toast.success("Evento apagado."); refresh(); }, onError: error => toast.error(error.message) });
  const uploadImage = trpc.admin.uploadEventImage.useMutation({ onSuccess: result => setForm(current => ({ ...current, imageUrl: result.url })) });

  const events = (query.data ?? []) as Event[];

  const beginEdit = (event: Event) => { setEditing(event); setForm({ title: event.title, description: event.description ?? "", imageUrl: event.imageUrl ?? "", eventDate: event.eventDate ?? "", active: event.active }); };
  const beginCreate = () => { setCreating(true); setForm(blank); };
  const close = () => { setEditing(null); setCreating(false); };

  const handleImageFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100_000_000) {
      toast.error("Escolha uma imagem de até 100 MB.");
      return;
    }
    void compressImageFile(file, { maxDimension: 2000 }).then(({ base64, contentType }) => {
      uploadImage.mutate({ filename: file.name, contentType: contentType as "image/jpeg" | "image/png" | "image/webp", dataBase64: base64 });
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: editing?.id, title: form.title, description: form.description || undefined, imageUrl: form.imageUrl || undefined, eventDate: form.eventDate || undefined, active: form.active, sortOrder: editing?.sortOrder ?? events.length + 1 });
  };

  if (snapshot.isLoading) return <Loading />;
  if (locked) return <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} featureId="events" />;

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Vitrine</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Eventos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Divulgue eventos especiais (shows, aniversário da casa, datas comemorativas). Eles aparecem junto com as promoções na página inicial, com destaque de evento.</p>
        </div>
        <Button onClick={beginCreate} className="shrink-0 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-1.5 h-4 w-4" />Novo evento</Button>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : query.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6"><p className="font-semibold text-red-900">Não foi possível carregar os eventos.</p><p className="mt-1 text-sm text-red-800">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()} className="mt-4 rounded-xl border-red-300 bg-white text-red-800">Tentar novamente</Button></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map(event => (
            <article key={event.id} className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
              {event.imageUrl ? <img src={event.imageUrl} alt="" className="h-32 w-full object-cover" /> : <div className="grid h-32 w-full place-items-center bg-[#f3eadf] text-primary"><CalendarDays className="h-8 w-8" /></div>}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{event.title}</p>
                  <Badge variant="outline" className={`shrink-0 rounded-full ${event.active ? "" : "border-amber-300 text-amber-700"}`}>{event.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                {event.eventDate ? <p className="mt-1 text-xs font-semibold text-[#8a5c3f]">{event.eventDate}</p> : null}
                {event.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.description}</p> : null}
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(event)} className="h-9 rounded-lg border-[#d7c5af] bg-white text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
                  <Button type="button" size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Apagar o evento "${event.title}"?`)) remove.mutate({ id: event.id }); }} className="h-9 rounded-lg border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Apagar</Button>
                </div>
              </div>
            </article>
          ))}
          {!events.length ? <p className="text-sm text-muted-foreground">Nenhum evento cadastrado ainda. Clique em "Novo evento" para criar o primeiro.</p> : null}
        </div>
      )}

      {(editing || creating) ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submit} className="my-6 w-full max-w-lg rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">{editing ? "Editar" : "Novo"}</p><h2 className="mt-1 font-display text-2xl font-bold">Evento</h2></div>
              <Button type="button" variant="ghost" onClick={close} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div><Label>Título do evento</Label><Input required autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Noite do Blues ao vivo" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Data/horário (texto livre)</Label><Input value={form.eventDate} onChange={event => setForm({ ...form, eventDate: event.target.value })} placeholder="Ex.: Sexta, 12 de setembro, a partir das 20h" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Descrição</Label><Textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="mt-1.5 min-h-24 rounded-xl bg-white" /></div>
              <div>
                <Label>Imagem do evento</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-[#d8c7b0] bg-white">{form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-[10px] text-muted-foreground">Sem imagem</span>}</div>
                  <div className="flex-1">
                    <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleImageFile(event.target.files?.[0])} className="h-10 rounded-xl bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#f3eadf] file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
                    <p className="mt-1 text-xs text-muted-foreground">Até 100 MB por imagem.</p>
                    {uploadImage.isPending && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Enviando imagem, pode levar um instante em arquivos grandes…</p>}
                    {uploadImage.error && <p className="mt-1 text-xs text-red-700">{uploadImage.error.message}</p>}
                    {form.imageUrl && <button type="button" onClick={() => setForm({ ...form, imageUrl: "" })} className="mt-1 text-xs font-semibold text-primary hover:underline">Remover imagem</button>}
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-primary" />Exibir agora na página inicial</label>
            </div>
            {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
            <Button disabled={save.isPending || uploadImage.isPending} className="mt-6 h-11 w-full rounded-xl bg-primary hover:bg-primary-hover">{save.isPending ? "Salvando…" : "Salvar evento"}</Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
