import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProductDialog from "@/components/ProductDialog";
import ProductSearch from "@/components/ProductSearch";
import { getFeatureLockedInfo, UpgradeNudgeModal } from "@/components/admin/LockedFeature";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, BellRing, CalendarClock, CheckCheck, ChevronDown, Loader2, Minus, Plus, ReceiptText, ShoppingBag, Trash2, UtensilsCrossed, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
// Verde/vermelho fortes de propósito (livre vs. ocupada) — pra dar pra
// reconhecer o status da mesa num relance, mesmo de longe no salão; as
// outras cores continuam sutis, só pra sinalizar exceção (pagamento
// pendente, reserva chegando, mesa inativa), não pra competir visualmente.
const STATUS_TONE: Record<string, string> = {
  FREE: "border-emerald-500 bg-emerald-200",
  OCCUPIED: "border-red-500 bg-red-200",
  AWAITING_PAYMENT: "border-rose-300 bg-rose-50",
  RESERVED: "border-sky-300 bg-sky-50",
  INACTIVE: "border-stone-300 bg-stone-100 opacity-60",
};
const STATUS_LABEL: Record<string, string> = { FREE: "Livre", OCCUPIED: "Ocupada", AWAITING_PAYMENT: "Aguardando pagamento", RESERVED: "Reservada", INACTIVE: "Inativa" };
const ORDER_STATUS_LABEL: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Aceito", PREPARING: "Em preparo", READY_FOR_PICKUP: "Pronto para servir", COMPLETED: "Servido", CANCELLED: "Cancelado" };
const ORIGIN_LABEL: Record<string, string> = { GARCOM: "Lançado pela equipe", QR_CODE: "Pedido pelo QR Code", SITE: "Site", BALCAO: "Balcão" };
const LATE_THRESHOLD_MS = 30 * 60 * 1000;

function elapsedLabel(sinceMs: number, nowMs: number) {
  const minutes = Math.max(0, Math.round((nowMs - sinceMs) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${String(minutes % 60).padStart(2, "0")}` : `${minutes}min`;
}

function ServiceRequestsPanel() {
  const utils = trpc.useUtils();
  // Mesma consulta que TableMapManager/RestaurantOrders.tsx pedem (mesmo
  // input `undefined`, mesmo refetchInterval) — o React Query compartilha a
  // rede entre os três em vez de disparar 3 pollings de 10s concorrentes.
  const snapshot = trpc.admin.operationalSnapshot.useQuery(undefined, { refetchInterval: 10000 });
  const requests = snapshot.data?.pendingServiceRequests;
  const resolve = trpc.admin.resolveServiceRequest.useMutation({ onSuccess: () => void utils.admin.operationalSnapshot.invalidate(), onError: error => toast.error(error.message) });
  if (snapshot.error) return <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar os chamados de garçom agora. {snapshot.error.message}</section>;
  if (!requests?.length) return null;
  return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
    <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900"><BellRing className="h-4 w-4" />Chamados de garçom ({requests.length})</h3>
    <div className="mt-3 space-y-2">{requests.map(request => <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 p-2.5"><span className="text-sm font-medium">{request.tableLabel}</span><Button size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: request.id, status: "DONE" })} className="h-8 rounded-lg bg-amber-800 text-xs hover:bg-amber-900"><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Atendido</Button></div>)}</div>
  </section>;
}

function AddRoundForm({ tableId, sessionId, onDone }: { tableId: number; sessionId: number; onDone: () => void }) {
  const utils = trpc.useUtils();
  const { items, subtotalCents, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [lockInfo, setLockInfo] = useState<ReturnType<typeof getFeatureLockedInfo>>(null);
  const addRound = trpc.admin.addManualRound.useMutation({
    onSuccess: () => {
      clearCart();
      void utils.admin.operationalSnapshot.invalidate();
      void utils.admin.sessionDetail.invalidate({ sessionId });
      toast.success("Rodada lançada na comanda.");
      onDone();
    },
    onError: error => {
      const locked = getFeatureLockedInfo(error);
      if (locked) { setLockInfo(locked); return; }
      toast.error(error.message);
    },
  });
  return <div className="space-y-3 rounded-xl border border-[#e4d8c8] bg-white p-3">
    <UpgradeNudgeModal open={Boolean(lockInfo)} onOpenChange={open => { if (!open) setLockInfo(null); }} info={lockInfo} />
    <ProductSearch onSelect={setSelectedProduct} />
    {items.length > 0 && <div className="space-y-2 border-t border-[#f1e9dc] pt-2">{items.map(item => { const unit = item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0); return <div key={item.id} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm">{item.name}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-sm">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Plus className="h-3 w-3" /></button><span className="w-16 shrink-0 text-right text-sm font-semibold">{money(unit * item.quantity)}</span><button type="button" onClick={() => removeItem(item.id)} className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}<div className="flex items-center justify-between pt-1"><span className="text-sm font-bold">Subtotal: {money(subtotalCents)}</span><Button size="sm" disabled={addRound.isPending} onClick={() => addRound.mutate({ tableId, items: items.map(item => ({ productId: item.productId, quantity: item.quantity, addonOptionIds: item.addons.map(addon => addon.id), note: item.note })) })} className="h-9 rounded-lg bg-primary text-xs hover:bg-primary-hover">{addRound.isPending ? "Lançando…" : "Lançar rodada"}</Button></div></div>}
    <ProductDialog product={selectedProduct} open={Boolean(selectedProduct)} onOpenChange={value => { if (!value) setSelectedProduct(null); }} />
  </div>;
}

function RecordPaymentForm({ sessionId, balanceDueCents }: { sessionId: number; balanceDueCents: number }) {
  const utils = trpc.useUtils();
  const [method, setMethod] = useState<"PIX" | "CASH" | "CARD_ON_DELIVERY" | "CARD_ONLINE">("PIX");
  const [amount, setAmount] = useState(() => (balanceDueCents / 100).toFixed(2).replace(".", ","));
  const [payerLabel, setPayerLabel] = useState("");
  const record = trpc.admin.recordBillPayment.useMutation({
    onSuccess: () => { void utils.admin.operationalSnapshot.invalidate(); void utils.admin.sessionDetail.invalidate({ sessionId }); toast.success("Pagamento registrado."); setPayerLabel(""); },
    onError: error => toast.error(error.message),
  });
  const amountCents = Math.round(Number(amount.replace(",", ".")) * 100 || 0);
  return <div className="rounded-xl border border-[#e4d8c8] bg-white p-3">
    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#806f61]">Registrar pagamento (divida em quantas partes precisar)</p>
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{([["PIX", "Pix"], ["CASH", "Dinheiro"], ["CARD_ON_DELIVERY", "Cartão"], ["CARD_ONLINE", "Online"]] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setMethod(value)} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${method === value ? "border-primary bg-[#fdf1eb] text-[#9f3d26]" : "border-[#e0d5c5]"}`}>{label}</button>)}</div>
    <div className="mt-2 grid grid-cols-2 gap-2"><div><Label className="text-xs">Valor</Label><Input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" className="mt-1 h-9 rounded-lg bg-white text-sm" /></div><div><Label className="text-xs">Quem pagou (opcional)</Label><Input value={payerLabel} onChange={event => setPayerLabel(event.target.value)} placeholder="Ex.: Pessoa 1" className="mt-1 h-9 rounded-lg bg-white text-sm" /></div></div>
    <Button size="sm" disabled={record.isPending || amountCents <= 0} onClick={() => record.mutate({ sessionId, method, amountCents, payerLabel: payerLabel || undefined })} className="mt-2 h-9 rounded-lg bg-primary text-xs hover:bg-primary-hover">{record.isPending ? "Registrando…" : "Registrar pagamento"}</Button>
  </div>;
}

function SessionDrawer({ sessionId, tableLabel, onClose }: { sessionId: number; tableLabel: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const detail = trpc.admin.sessionDetail.useQuery({ sessionId }, { refetchInterval: 8000 });
  const closeSession = trpc.admin.closeSession.useMutation({ onSuccess: () => { void utils.admin.operationalSnapshot.invalidate(); toast.success("Comanda fechada."); onClose(); }, onError: error => toast.error(error.message) });
  const cancelSession = trpc.admin.cancelSession.useMutation({ onSuccess: () => { void utils.admin.operationalSnapshot.invalidate(); toast.success("Comanda cancelada."); onClose(); }, onError: error => toast.error(error.message) });
  const data = detail.data;
  return <Dialog open onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="max-h-[92vh] w-full min-w-0 overflow-x-hidden overflow-y-auto rounded-2xl bg-[#fffdf8] sm:max-w-2xl">
    <DialogHeader><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Comanda</p><DialogTitle className="font-display text-3xl">{tableLabel}</DialogTitle></DialogHeader>
    {detail.isLoading || !data ? <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : <div className="mt-4 min-w-0 space-y-4">
      <div className="rounded-xl border border-[#e4d8c8] bg-white p-3"><h3 className="text-sm font-semibold">Rodadas pedidas</h3><div className="mt-2 space-y-2">{data.orders.length ? data.orders.map(order => <div key={order.id} className="flex items-center justify-between gap-2 border-t border-[#f1e9dc] pt-2 first:border-0 first:pt-0 text-sm"><div className="min-w-0 flex-1"><span className="font-medium">{ORDER_STATUS_LABEL[order.status] ?? order.status}</span><span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#a08f7e]">{ORIGIN_LABEL[order.origin] ?? order.origin}</span><p className="truncate text-xs text-muted-foreground">{order.items.map(item => `${item.quantity}× ${item.productName}`).join(" · ")}</p></div><strong className="shrink-0">{money(order.totalCents)}</strong></div>) : <p className="text-xs text-muted-foreground">Nenhuma rodada ainda.</p>}</div></div>
      <div className="rounded-xl bg-[#17120e] p-4 text-[#fffaf3]"><div className="flex justify-between text-sm"><span>Total da comanda</span><span className="font-bold text-[#e9c98f]">{money(data.totalCents)}</span></div><div className="mt-1 flex justify-between text-xs text-[#cdbfac]"><span>Pago</span><span>{money(data.paidCents)}</span></div><div className="mt-1 flex justify-between text-xs text-[#cdbfac]"><span>Saldo</span><span>{money(data.balanceDueCents)}</span></div></div>
      <div><h3 className="text-sm font-semibold">Lançar nova rodada</h3><div className="mt-2"><CartProvider storageKey={`pubx-staff-table-round-${data.table?.id}`}><AddRoundForm tableId={data.table!.id} sessionId={sessionId} onDone={() => void detail.refetch()} /></CartProvider></div></div>
      {data.balanceDueCents > 0 && <div><h3 className="text-sm font-semibold">Fechar conta</h3><div className="mt-2"><RecordPaymentForm sessionId={sessionId} balanceDueCents={data.balanceDueCents} /></div></div>}
      {data.billPayments.length > 0 && <div className="rounded-xl border border-[#e4d8c8] bg-white p-3"><h3 className="text-sm font-semibold">Pagamentos registrados</h3><div className="mt-2 space-y-1 text-xs text-muted-foreground">{data.billPayments.map(payment => <p key={payment.id}>{payment.payerLabel ? `${payment.payerLabel} · ` : ""}{money(payment.amountCents)} — {payment.method}</p>)}</div></div>}
      <div className="flex flex-wrap gap-2 border-t border-[#eee4d8] pt-4"><Button disabled={data.balanceDueCents > 0 || closeSession.isPending} onClick={() => closeSession.mutate({ sessionId })} className="h-10 rounded-xl bg-[#3f7a52] hover:bg-[#2f5d3e]"><ReceiptText className="mr-1.5 h-4 w-4" />{closeSession.isPending ? "Fechando…" : "Fechar comanda"}</Button><Button variant="outline" disabled={cancelSession.isPending} onClick={() => { if (window.confirm("Cancelar esta comanda? Os pedidos continuam no histórico, mas a mesa volta a ficar livre.")) cancelSession.mutate({ sessionId }); }} className="h-10 rounded-xl border-red-200 text-red-700 hover:bg-red-50"><XCircle className="mr-1.5 h-4 w-4" />Cancelar comanda</Button></div>
      {data.balanceDueCents > 0 && <p className="text-xs text-[#a43720]">Registre o pagamento do saldo restante antes de fechar a comanda.</p>}
    </div>}
  </DialogContent></Dialog>;
}

export default function TableMapManager() {
  const utils = trpc.useUtils();
  // Mesma consulta de RestaurantOrders.tsx/ServiceRequestsPanel acima (mesmo
  // input `undefined`, mesmo refetchInterval) — compartilhada via cache do
  // React Query, não é um 3º polling separado.
  const snapshot = trpc.admin.operationalSnapshot.useQuery(undefined, { refetchInterval: 10000 });
  const tables = { data: snapshot.data?.tables, isLoading: snapshot.isLoading, error: snapshot.error };
  const [openSessionId, setOpenSessionId] = useState<{ id: number; label: string } | null>(null);
  const [openSectors, setOpenSectors] = useState<Set<string>>(new Set());
  const toggleSector = (sector: string) => setOpenSectors(current => { const next = new Set(current); if (next.has(sector)) next.delete(sector); else next.add(sector); return next; });
  const seatTable = trpc.admin.seatTable.useMutation({
    onSuccess: (result, variables) => {
      void utils.admin.operationalSnapshot.invalidate();
      const label = tables.data?.find(row => row.table.id === variables.tableId)?.table.label ?? "Mesa";
      setOpenSessionId({ id: result.sessionId, label });
    },
    onError: error => toast.error(error.message),
  });
  const bySector = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof tables.data>>();
    for (const row of tables.data ?? []) { const key = row.table.sector || "Sem setor"; if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(row); }
    return Array.from(groups.entries());
  }, [tables.data]);

  if (tables.isLoading) return <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (tables.error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center text-sm text-red-700">Não foi possível carregar o mapa de mesas agora. {tables.error.message}</div>;
  if (!tables.data?.length) return <div className="rounded-2xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-10 text-center"><UtensilsCrossed className="mx-auto h-8 w-8 text-[#b89e7a]" /><p className="mt-3 font-semibold">Nenhuma mesa cadastrada ainda.</p><p className="mt-1 text-sm text-muted-foreground">Cadastre as mesas do salão em Admin → Mesas.</p></div>;

  const now = Date.now();
  return <div className="space-y-6">
    <ServiceRequestsPanel />
    {bySector.map(([sector, rows]) => {
      const isOpen = openSectors.has(sector);
      const occupiedCount = rows.filter(row => row.session).length;
      return <section key={sector} className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
        <button type="button" onClick={() => toggleSector(sector)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-[#f6ede0]">
          <h3 className="text-sm font-bold uppercase tracking-[.1em] text-[#806f61]">{sector}</h3>
          <div className="flex shrink-0 items-center gap-3">
            <Badge variant="outline" className="rounded-full text-[10px]">{occupiedCount}/{rows.length} ocupadas</Badge>
            <ChevronDown className={`h-4 w-4 text-[#8a5c3f] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>
        <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className="grid grid-cols-2 gap-3 border-t border-[#eee5d9] p-3 sm:grid-cols-3 lg:grid-cols-4">{rows.map(row => {
              const late = Boolean(row.oldestActiveOrderAt) && now - row.oldestActiveOrderAt! > LATE_THRESHOLD_MS;
              return <button type="button" key={row.table.id} onClick={() => row.session ? setOpenSessionId({ id: row.session.id, label: row.table.label }) : seatTable.mutate({ tableId: row.table.id })} disabled={(!row.session && row.table.status !== "FREE") || seatTable.isPending} className={`relative rounded-2xl border p-3 text-left transition hover:shadow-md disabled:opacity-60 ${STATUS_TONE[row.table.status] ?? STATUS_TONE.FREE}`}>
                <div className="flex items-center justify-between gap-2"><strong className="font-display text-lg">{row.table.label}</strong><Badge variant="outline" className="border-current text-[10px]">{STATUS_LABEL[row.table.status] ?? row.table.status}</Badge></div>
                <p className="mt-1 text-xs text-muted-foreground">{row.table.capacity} lugares</p>
                {row.session && <p className="mt-2 text-sm font-semibold">{money(row.totalCents)} · {elapsedLabel(row.session.openedAt, now)}</p>}
                {row.minutesToReservation !== null && row.minutesToReservation <= 60 && <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-sky-800"><CalendarClock className="h-3 w-3" />Reserva em {row.minutesToReservation}min</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {late && <span className="flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white"><AlertTriangle className="h-3 w-3" />Atrasado</span>}
                  {row.hasPendingOrder && <span className="flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white"><ShoppingBag className="h-3 w-3" />Novo pedido</span>}
                  {row.waiterRequested && <span className="flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white"><BellRing className="h-3 w-3" />Garçom</span>}
                </div>
              </button>;
            })}</div>
          </div>
        </div>
      </section>;
    })}
    {openSessionId && <SessionDrawer sessionId={openSessionId.id} tableLabel={openSessionId.label} onClose={() => setOpenSessionId(null)} />}
  </div>;
}
