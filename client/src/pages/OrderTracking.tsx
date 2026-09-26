import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WhatsAppButton from "@/components/WhatsAppButton";
import { copyToClipboard } from "@/lib/clipboard";
import { trpc } from "@/lib/trpc";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { isMarcaBackground, MARCA_GRADIENT } from "@shared/colorThemes";
import { ArrowLeft, Check, CircleDot, Clock3, MapPin, PackageCheck, Phone, QrCode, Search, XCircle } from "lucide-react";
import QRCodeLib from "qrcode";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

const labels: Record<string, string> = { PENDING: "Pedido recebido", ACCEPTED: "Pedido aceito", PREPARING: "Em preparo", OUT_FOR_DELIVERY: "Saiu para entrega", READY_FOR_PICKUP: "Pronto para retirada", COMPLETED: "Pedido concluído", CANCELLED: "Pedido cancelado" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** QR gerado no cliente a partir do "copia e cola" — o servidor nunca manda a imagem em si (ver server/db/orders.ts::savePixChargeForOrder). */
function PixChargeCard({ pixCopyPaste, expiresAt }: { pixCopyPaste: string; expiresAt: number }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { void QRCodeLib.toDataURL(pixCopyPaste, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null)); }, [pixCopyPaste]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const remainingMs = Math.max(0, expiresAt - now);
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);
  if (remainingMs <= 0) return <div className="mt-5 rounded-xl border border-[#493c2f] bg-[#211a13] p-4"><p className="flex items-center gap-2 text-sm font-semibold text-[#f1d7aa]"><QrCode className="h-4 w-4" />O Pix expirou</p><p className="mt-1 text-xs text-[#cdbfac]">Fale com a equipe pra combinar outra forma de pagamento.</p></div>;
  return <div className="mt-5 rounded-xl border border-[#493c2f] bg-[#211a13] p-4">
    <p className="flex items-center gap-2 text-sm font-semibold text-[#f1d7aa]"><QrCode className="h-4 w-4" />Pague com Pix agora</p>
    <p className="mt-1 text-xs text-[#cdbfac]">Confirmação automática — o pedido atualiza sozinho assim que você pagar. Expira em {minutes}:{String(seconds).padStart(2, "0")}.</p>
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {qrDataUrl && <img src={qrDataUrl} alt="QR Code Pix" className="h-32 w-32 rounded-lg bg-white object-contain p-1" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[#cdbfac]">Pix copia e cola</p>
        <div className="mt-1 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-[#fffaf3] px-2.5 py-2 text-xs text-[#241b16]">{pixCopyPaste}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard(pixCopyPaste)} className="h-8 shrink-0 rounded-lg border-[#493c2f] bg-transparent text-xs text-[#f1d7aa] hover:bg-[#2c241a]">Copiar</Button>
        </div>
      </div>
    </div>
  </div>;
}

export default function OrderTracking() {
  const [, setLocation] = useLocation();
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [phone, setPhone] = useState(initial.get("telefone") ?? "");
  const [submitted, setSubmitted] = useState(Boolean(initial.get("telefone")));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const normalizedPhone = phone.replace(/\D/g, "");
  const validPhone = normalizedPhone.length === 10 || normalizedPhone.length === 11;
  const query = trpc.order.track.useQuery({ phone: normalizedPhone }, { enabled: submitted && validPhone, retry: false, refetchInterval: 15000 });
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);
  const trackingOrders = query.data ?? [];
  const order = trackingOrders.find(item => item.id === selectedOrderId) ?? trackingOrders[0];
  const history = order?.history ?? []; const done = order?.status === "COMPLETED"; const cancelled = order?.status === "CANCELLED";
  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => { if (trackingOrders.length) setSelectedOrderId(current => trackingOrders.some(orderItem => orderItem.id === current) ? current : trackingOrders[0]!.id); }, [trackingOrders]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!validPhone) { setPhoneError("Informe um telefone válido com DDD e 10 ou 11 dígitos."); setSubmitted(false); return; } setPhoneError(null); setSubmitted(true); };

  return <div className="min-h-screen bg-background" style={marca ? { background: MARCA_GRADIENT } : undefined}><header className="border-b bg-[#fffdf8] text-[#231d18]"><div className="page-shell flex h-16 items-center justify-between"><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Cardápio</button><span className="font-display text-xl font-bold">MM System Creator</span><span className="w-20" /></div></header><main className="page-shell max-w-3xl py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Acompanhe seu pedido</p><h1 className="mt-2 font-display text-4xl font-bold">Tudo sob controle.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Informe o telefone usado no checkout para consultar seus pedidos em andamento.</p><form onSubmit={submit} noValidate className="mt-7 grid gap-3 rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)] sm:grid-cols-[1fr_auto]"><div><Label htmlFor="phone">Telefone usado no pedido</Label><Input id="phone" value={phone} onChange={event => { setPhone(event.target.value); setSubmitted(false); setPhoneError(null); }} inputMode="tel" autoComplete="tel" aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "phone-error" : undefined} placeholder="(85) 99999-9999" className="mt-2 h-10 rounded-xl bg-[#fffdfa] text-[#231d18]" />{phoneError && <p id="phone-error" role="alert" className="mt-2 text-sm font-medium text-[#a43720]">{phoneError}</p>}</div><Button className="h-10 self-end rounded-xl bg-primary hover:bg-primary-hover"><Search className="mr-2 h-4 w-4" />Buscar pedido</Button></form><p className="mt-3 flex items-center gap-2 text-xs leading-5 text-muted-foreground"><Phone className="h-3.5 w-3.5 text-primary" />Por privacidade, são exibidos apenas pedidos em andamento vinculados ao telefone informado.</p>{query.error && <p className="mt-4 rounded-xl border border-[#edb8aa] bg-[#fff2ee] p-4 text-sm text-[#a43720]">{query.error.message}</p>}{query.isFetching && <p className="mt-7 text-center text-sm text-muted-foreground">Consultando o status do pedido…</p>}{trackingOrders.length > 1 && <section className="mt-6 rounded-2xl border border-[#e3d5c2] bg-[#fffaf3] p-5 text-[#231d18]"><p className="font-semibold">Encontramos {trackingOrders.length} pedidos em andamento.</p><p className="mt-1 text-sm text-[#8a7a68]">Escolha o pedido que deseja acompanhar.</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{trackingOrders.map(orderItem => <button key={orderItem.id} type="button" onClick={() => setSelectedOrderId(orderItem.id)} className={`rounded-xl border p-3 text-left text-[#231d18] transition ${orderItem.id === order?.id ? "border-primary bg-[#fdf1eb]" : "border-[#dfd2c0] bg-white hover:border-primary"}`}><span className="block text-sm font-semibold">{labels[orderItem.status]}</span><span className="mt-1 block text-xs text-[#8a7a68]">{new Date(orderItem.createdAt).toLocaleString("pt-BR")} · {orderItem.fulfillmentType === "DELIVERY" ? "Entrega" : orderItem.fulfillmentType === "DINE_IN" ? "Mesa" : "Retirada"}</span></button>)}</div></section>}{order && <section className="mt-6 rounded-2xl bg-[#17120e] p-5 text-[#fffaf3] sm:p-6"><p className="text-xs font-bold uppercase tracking-[.14em] text-[#e9c98f]">Resumo do pedido</p><div className="mt-4 space-y-3">{order.items.map(item => <div className="flex justify-between gap-3 text-sm" key={item.id}><span>{item.quantity}× {item.productName}</span><span>{money(item.lineTotalCents)}</span></div>)}</div><div className="mt-5 border-t border-[#493c2f] pt-4"><div className="flex justify-between font-bold"><span>Total</span><span className="text-[#e9c98f]">{money(order.totalCents)}</span></div></div>{order.pixCharge && <PixChargeCard pixCopyPaste={order.pixCharge.pixCopyPaste} expiresAt={order.pixCharge.expiresAt} />}<div className="mt-5 flex items-start gap-2 text-xs leading-5 text-[#cdbfac]">{order.fulfillmentType === "DELIVERY" ? <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> : <PackageCheck className="mt-0.5 h-4 w-4 shrink-0" />}<span>{order.fulfillmentType === "DELIVERY" ? "Entrega no endereço informado no checkout." : order.fulfillmentType === "DINE_IN" ? "Pedido feito na mesa." : "Retirada no balcão do MM System Creator."}</span></div></section>}{order && <section className="mt-6 rounded-2xl bg-[#fffdf8] p-6 text-[#231d18] shadow-[0_12px_35px_rgba(53,34,17,.06)]"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-primary">Pedido em andamento</p><h2 className="mt-1 font-display text-3xl font-bold">{labels[order.status]}</h2><p className="mt-2 text-xs text-[#8a7a68]">Realizado em {new Date(order.createdAt).toLocaleString("pt-BR")}</p></div>{cancelled ? <XCircle className="h-8 w-8 text-primary" /> : done ? <Check className="h-8 w-8 text-[#497455]" /> : <Clock3 className="h-8 w-8 text-primary" />}</div>{!cancelled && !done && <p className="mt-3 text-sm leading-6 text-[#8a7a68]">{order.fulfillmentType === "DELIVERY" ? "Seu pedido segue no fluxo da cozinha e entrega." : "Seu pedido segue no fluxo da cozinha para retirada."}</p>}<div className="mt-8 space-y-0">{history.map((entry, index) => <div className="relative flex gap-4 pb-7 last:pb-0" key={entry.id}><div className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f3e2d8] text-primary"><CircleDot className="h-3.5 w-3.5" /></div>{index < history.length - 1 && <div className="absolute left-[13px] top-7 h-[calc(100%-28px)] w-px bg-[#e2d6c5]" />}<div><p className="font-semibold">{labels[entry.status]}</p><p className="mt-1 text-xs text-[#8a7a68]">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div></div>)}</div></section>}<WhatsAppButton phone={settings.data?.phone} /></main></div>;
}
