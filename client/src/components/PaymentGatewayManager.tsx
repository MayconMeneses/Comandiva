import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CreditCard, Pencil, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const PROVIDER_LABELS: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  PAGSEGURO: "PagSeguro / PagBank",
  STRIPE: "Stripe",
  CIELO: "Cielo",
  REDE: "Rede",
  GETNET: "GetNet",
  PAYPAL: "PayPal",
  OUTRO: "Outro",
};

const AUTOMATIC_PROVIDERS = new Set(["MERCADO_PAGO"]);

type Gateway = { id: number; provider: string; label: string; hasApiKey: boolean; hasSecretKey: boolean; extra: string | null; active: boolean };
type Form = { provider: string; label: string; apiKey: string; secretKey: string; extra: string };
const blank: Form = { provider: "MERCADO_PAGO", label: "", apiKey: "", secretKey: "", extra: "" };

export default function PaymentGatewayManager() {
  const utils = trpc.useUtils();
  const query = trpc.admin.paymentGateways.useQuery();
  const [editing, setEditing] = useState<Gateway | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(blank);

  const refresh = () => void utils.admin.paymentGateways.invalidate();
  const save = trpc.admin.savePaymentGateway.useMutation({ onSuccess: () => { toast.success("Gateway salvo."); setEditing(null); setCreating(false); refresh(); }, onError: error => toast.error(error.message) });
  const setActive = trpc.admin.setActivePaymentGateway.useMutation({ onSuccess: () => { refresh(); }, onError: error => toast.error(error.message) });
  const remove = trpc.admin.deletePaymentGateway.useMutation({ onSuccess: () => { toast.success("Removido."); refresh(); }, onError: error => toast.error(error.message) });

  if (!query.data) return null;
  const gateways = query.data as Gateway[];

  const beginEdit = (gateway: Gateway) => { setEditing(gateway); setForm({ provider: gateway.provider, label: gateway.label, apiKey: "", secretKey: "", extra: gateway.extra ?? "" }); };
  const beginCreate = () => { setCreating(true); setForm(blank); };
  const close = () => { setEditing(null); setCreating(false); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: editing?.id, provider: form.provider as never, label: form.label, apiKey: form.apiKey || undefined, secretKey: form.secretKey || undefined, extra: form.extra || undefined });
  };

  return (
    <section className="mt-10 border-t border-[#ddcfbd] pt-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Pagamento</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Pagamento online (cartão)</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre as credenciais de uma ou mais processadoras. Só a marcada como "Ativa" é usada no checkout. Hoje a cobrança automática funciona para <strong>Mercado Pago</strong> — as demais ficam salvas, prontas para ativar quando você conectar.</p>
        </div>
        <Button onClick={beginCreate} className="shrink-0 rounded-xl bg-[#b4472d] hover:bg-[#943722]"><Plus className="mr-1.5 h-4 w-4" />Novo gateway</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {gateways.map(gateway => (
          <article key={gateway.id} className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{gateway.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{PROVIDER_LABELS[gateway.provider] ?? gateway.provider}{!AUTOMATIC_PROVIDERS.has(gateway.provider) ? " · cobrança automática ainda não conectada" : ""}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {gateway.active ? <Badge className="border-0 bg-emerald-600 text-white">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                <span className="text-[10px] text-muted-foreground">{gateway.hasApiKey ? "Chave configurada" : "Sem chave"}{gateway.hasSecretKey ? " · secreta ok" : ""}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={gateway.active} onChange={event => setActive.mutate({ id: gateway.id, active: event.target.checked })} className="h-4 w-4 accent-[#b4472d]" />
                Usar no checkout
              </label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => beginEdit(gateway)} className="h-9 rounded-lg border-[#d7c5af] bg-white text-xs text-[#613b2a] hover:bg-[#f6e7d9]"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar</Button>
                <Button type="button" size="sm" variant="outline" disabled={remove.isPending} onClick={() => { if (window.confirm(`Remover as credenciais de "${gateway.label}"?`)) remove.mutate({ id: gateway.id }); }} className="h-9 rounded-lg border-red-200 bg-white text-xs text-red-700 hover:bg-red-50"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Remover</Button>
              </div>
            </div>
          </article>
        ))}
        {!gateways.length ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" />Nenhum gateway cadastrado ainda.</p> : null}
      </div>

      {(editing || creating) ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-[#fffdf8] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#b4472d]">{editing ? "Editar" : "Novo"}</p><h2 className="mt-1 font-display text-2xl font-bold">Gateway de pagamento</h2></div>
              <Button type="button" variant="ghost" onClick={close} className="h-9 w-9 rounded-lg p-0"><X className="h-5 w-5" /></Button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <Label>Processadora</Label>
                <select required value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-input bg-white px-3 text-sm">
                  {Object.entries(PROVIDER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                {!AUTOMATIC_PROVIDERS.has(form.provider) ? <p className="mt-1.5 text-xs text-amber-700">A cobrança automática para esta processadora ainda não está conectada — as credenciais ficam salvas para quando eu conectar.</p> : null}
              </div>
              <div><Label>Nome para identificar (ex.: "Mercado Pago — loja principal")</Label><Input required autoFocus value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Chave/Token de API (Access Token) {editing ? "— deixe em branco para manter a atual" : ""}</Label><Input type="password" value={form.apiKey} onChange={event => setForm({ ...form, apiKey: event.target.value })} placeholder={editing ? "••••••••" : "Cole aqui o Access Token"} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Chave secreta {editing?.hasSecretKey ? "(já configurada — deixe em branco para manter)" : "(se aplicável)"}</Label><Input type="password" value={form.secretKey} onChange={event => setForm({ ...form, secretKey: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
              <div><Label>Observações (opcional)</Label><Input value={form.extra} onChange={event => setForm({ ...form, extra: event.target.value })} className="mt-1.5 h-11 rounded-xl bg-white" /></div>
            </div>
            {save.error ? <p className="mt-4 text-sm text-red-700">{save.error.message}</p> : null}
            <Button disabled={save.isPending} className="mt-6 h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{save.isPending ? "Salvando…" : "Salvar gateway"}</Button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
