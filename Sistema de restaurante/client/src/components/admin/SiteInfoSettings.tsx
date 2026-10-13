import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { MapPin, Phone } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function SiteInfoSettings({ settings }: { settings: { isAcceptingOrders: boolean; deliveryFeeCents: number; minimumOrderCents: number; estimatedDeliveryMin: number; estimatedDeliveryMax: number; openingHours: string | null; address?: string | null; phone?: string | null; aboutText?: string | null } | null | undefined }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(() => ({ address: settings?.address ?? "", phone: settings?.phone ?? "", aboutText: settings?.aboutText ?? "" }));
  const update = trpc.admin.updateSettings.useMutation({ onSuccess: () => { toast.success("Informações salvas."); void utils.admin.dashboard.invalidate(); void utils.catalog.settings.invalidate(); }, onError: error => toast.error(error.message) });
  if (!settings) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ isAcceptingOrders: settings.isAcceptingOrders, deliveryFeeCents: settings.deliveryFeeCents, minimumOrderCents: settings.minimumOrderCents, estimatedDeliveryMin: settings.estimatedDeliveryMin, estimatedDeliveryMax: settings.estimatedDeliveryMax, openingHours: settings.openingHours ?? "", address: form.address, phone: form.phone, aboutText: form.aboutText });
  };
  return <section className="rounded-2xl border border-border bg-card text-card-foreground p-6">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Vitrine e contato</p>
    <h2 className="mt-1 font-display text-2xl font-bold">Endereço, WhatsApp e Sobre</h2>
    <p className="mt-1 text-sm text-muted-foreground">Usados no rodapé, na página "Sobre" e no botão de WhatsApp flutuante do site.</p>
    <form onSubmit={submit} className="mt-5 space-y-4">
      <div><Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />Endereço do local</Label><Textarea value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, bairro — cidade/UF" className="mt-1.5 min-h-16 rounded-xl bg-card" /></div>
      <div><Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />WhatsApp / telefone de contato</Label><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="Ex.: 85999999999 (com DDD, só números)" className="mt-1.5 h-11 rounded-xl bg-card" /><p className="mt-1 text-xs text-muted-foreground">É para este número que o botão de WhatsApp do site leva o cliente.</p></div>
      <div><Label>Texto da página "Sobre"</Label><Textarea value={form.aboutText} onChange={event => setForm({ ...form, aboutText: event.target.value })} placeholder="Conte a história do Comandiva, o que torna o lugar especial…" className="mt-1.5 min-h-32 rounded-xl bg-card" /><p className="mt-1 text-xs text-muted-foreground">Se deixar em branco, o site usa um texto padrão em /sobre.</p></div>
      {update.error ? <p className="text-sm text-red-700">{update.error.message}</p> : null}
      <Button disabled={update.isPending} className="h-11 rounded-xl bg-primary hover:bg-primary-hover">{update.isPending ? "Salvando…" : "Salvar informações"}</Button>
    </form>
  </section>;
}
