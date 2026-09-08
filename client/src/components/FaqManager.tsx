import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { HelpCircle, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type FaqItem = { id: number; question: string; answer: string; active: boolean; sortOrder: number };
type Form = { question: string; answer: string; active: boolean };
const blank: Form = { question: "", answer: "", active: true };

export default function FaqManager() {
  const utils = trpc.useUtils();
  const query = trpc.admin.faqItems.useQuery();
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const refresh = () => { void utils.admin.faqItems.invalidate(); void utils.catalog.faqItems.invalidate(); };
  const save = trpc.admin.saveFaqItem.useMutation({ onSuccess: () => { toast.success(editing ? "Pergunta atualizada." : "Pergunta criada."); setEditing(null); setCreating(false); refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deleteFaqItem.useMutation({ onSuccess: () => { toast.success("Pergunta apagada."); refresh(); }, onError: error => toast.error(error.message) });

  const items = (query.data ?? []) as FaqItem[];

  const beginEdit = (item: FaqItem) => { setEditing(item); setForm({ question: item.question, answer: item.answer, active: item.active }); };
  const beginCreate = () => { setCreating(true); setForm(blank); };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: editing?.id, question: form.question, answer: form.answer, active: form.active, sortOrder: editing?.sortOrder ?? items.length + 1 });
  };

  return (
    <>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Ajuda</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Perguntas frequentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aparecem em /faq, abaixo das respostas automáticas (horário, entrega e pagamento, que já se atualizam sozinhas).</p>
        </div>
        <Button onClick={beginCreate} className="shrink-0 rounded-xl bg-[#b4472d] hover:bg-[#943722]"><Plus className="mr-1.5 h-4 w-4" />Nova pergunta</Button>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-10"><Loader2 className="h-6 w-6 animate-spin text-[#b4472d]" /></div>
      ) : query.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6"><p className="font-semibold text-red-900">Não foi possível carregar as perguntas.</p><p className="mt-1 text-sm text-red-800">{query.error.message}</p><Button variant="outline" onClick={() => void query.refetch()} className="mt-4 rounded-xl border-red-300 bg-white text-red-800">Tentar novamente</Button></div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <article key={item.id} className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="font-semibold">{item.question}</p><Badge variant="outline" className={`shrink-0 rounded-full ${item.active ? "" : "border-amber-300 text-amber-700"}`}>{item.active ? "Ativa" : "Inativa"}</Badge></div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.answer}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(item)} className="h-9 rounded-lg border-[#d7c5af] bg-white text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Apagar a pergunta "${item.question}"?`)) remove.mutate({ id: item.id }); }} className="h-9 rounded-lg border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </article>
          ))}
          {!items.length ? <div className="rounded-2xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-8 text-center"><HelpCircle className="mx-auto h-8 w-8 text-[#b89e7a]" /><p className="mt-3 text-sm text-muted-foreground">Nenhuma pergunta personalizada cadastrada ainda.</p></div> : null}
        </div>
      )}

      {(editing || creating) ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4">
          <form onSubmit={submit} className="my-6 w-full max-w-lg rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4472d]">{editing ? "Editar" : "Nova"}</p><h2 className="mt-1 font-display text-2xl font-bold">Pergunta frequente</h2></div>
              <Button type="button" variant="ghost" onClick={close} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div><Label>Pergunta</Label><Input required autoFocus value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} placeholder="Ex.: Vocês entregam aos domingos?" className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Resposta</Label><Textarea required value={form.answer} onChange={event => setForm({ ...form, answer: event.target.value })} className="mt-1.5 min-h-28 rounded-xl bg-white" /></div>
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />Exibir agora em /faq</label>
            </div>
            {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
            <Button disabled={save.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{save.isPending ? "Salvando…" : "Salvar pergunta"}</Button>
          </form>
        </div>
      ) : null}
    </>
  );
}
