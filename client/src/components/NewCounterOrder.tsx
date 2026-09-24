import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProductDialog from "@/components/ProductDialog";
import ProductSearch from "@/components/ProductSearch";
import { trpc } from "@/lib/trpc";
import { generateClientId } from "@/lib/randomId";
import { isRetryingOffline, orderMutationRetryDelay, shouldRetryOrderMutation } from "@/lib/offlineRetry";
import { clearPendingOrder, persistPendingOrder, resumeOrCreateOperationId, PENDING_ORDER_SCHEMA_VERSION, PENDING_ORDER_WINDOW_MS } from "@/lib/pendingOrderQueue";
import { useStaleRetryWarning } from "@/hooks/useStaleRetryWarning";
import { addressMatchesRoute } from "@shared/orderDomain";
import { Minus, Phone, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const digits = (value: string) => value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");

export default function NewCounterOrder() {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const { items, subtotalCents, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [fulfillmentType, setFulfillmentType] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CASH" | "CARD_ON_DELIVERY">("PIX");
  const [phone, setPhone] = useState(""); const [name, setName] = useState(""); const [changeFor, setChangeFor] = useState("");
  const [deliveryRouteId, setDeliveryRouteId] = useState<number | undefined>();
  const [address, setAddress] = useState({ postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "Croatá", state: "CE", reference: "" });

  const normalizedPhone = digits(phone);
  const lookup = trpc.customer.lookupByPhone.useQuery({ phone: normalizedPhone }, { enabled: (normalizedPhone.length === 10 || normalizedPhone.length === 11) && open, retry: false });
  const deliveryRoutes = trpc.catalog.deliveryRoutes.useQuery(undefined, { enabled: open });
  const activeRoutes = deliveryRoutes.data ?? [];
  const selectedRoute = activeRoutes.find(route => route.id === deliveryRouteId);
  const routeRequired = fulfillmentType === "DELIVERY" && activeRoutes.length > 0;
  const addressLooksOutOfRoute = fulfillmentType === "DELIVERY" && Boolean(selectedRoute) && Boolean(address.neighborhood) && !addressMatchesRoute(selectedRoute, address);
  const deliveryFee = fulfillmentType === "DELIVERY" ? (selectedRoute?.deliveryFeeCents ?? 0) : 0;

  useEffect(() => {
    const customer = lookup.data; const primary = customer?.addresses?.[0];
    if (customer) { setName(customer.name); if (primary) setAddress({ postalCode: primary.postalCode ?? "", street: primary.street, number: primary.number, complement: primary.complement ?? "", neighborhood: primary.neighborhood, city: primary.city, state: primary.state, reference: primary.reference ?? "" }); }
  }, [lookup.data]);

  // Diálogo fica montado e é reaberto várias vezes ("Novo pedido") sem
  // recarregar a página — regenerar só no sucesso evita que o SEGUNDO
  // pedido de balcão do dia seja tratado como duplicata do primeiro (ver
  // comentário em insertPricedOrder, server/routers/order.ts).
  // A semente reusa uma pendência salva (F5 com pedido pausado) em vez de
  // sempre gerar um id novo — ver client/src/lib/pendingOrderQueue.ts.
  const operationIdRef = useRef(resumeOrCreateOperationId({ type: "order.create", screen: "counter" }));
  // Teto de tempo pro retry em memória — ver client/src/hooks/useStaleRetryWarning.ts.
  const startedAtRef = useRef<number | null>(null);
  const createOrder = trpc.order.create.useMutation({
    retry: shouldRetryOrderMutation,
    retryDelay: orderMutationRetryDelay,
    onMutate: variables => {
      const now = Date.now();
      startedAtRef.current = now;
      persistPendingOrder({ type: "order.create", screen: "counter", payload: variables, createdAt: now, itemCount: items.length, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
    },
    onSettled: () => { startedAtRef.current = null; clearPendingOrder({ type: "order.create", screen: "counter" }); },
    onSuccess: result => {
      operationIdRef.current = generateClientId();
      clearCart();
      void utils.admin.orders.invalidate();
      void utils.admin.operationalSnapshot.invalidate();
      void utils.admin.dashboard.invalidate();
      setOpen(false);
      setPhone(""); setName(""); setChangeFor(""); setFulfillmentType("PICKUP"); setDeliveryRouteId(undefined);
      setAddress({ postalCode: "", street: "", number: "", complement: "", neighborhood: "", city: "Croatá", state: "CE", reference: "" });
      toast.success(startedAtRef.current !== null && Date.now() - startedAtRef.current > PENDING_ORDER_WINDOW_MS ? `Pedido ${result.publicCode} confirmado após uma queda de conexão longa — confira os detalhes, o valor pode ter mudado.` : `Pedido ${result.publicCode} criado com sucesso.`);
    },
    onError: error => toast.error(error.message),
  });
  const createOrderStale = useStaleRetryWarning(isRetryingOffline(createOrder), startedAtRef.current);

  const total = subtotalCents + deliveryFee;
  const changeForCentsValue = paymentMethod === "CASH" && changeFor ? Math.round(Number(changeFor.replace(",", ".")) * 100) : undefined;
  const changeForInsufficient = changeForCentsValue !== undefined && changeForCentsValue < total;
  const canSubmit = items.length > 0 && normalizedPhone.length >= 10 && name.trim().length >= 2 && !(routeRequired && !deliveryRouteId) && !addressLooksOutOfRoute && !changeForInsufficient && (fulfillmentType === "PICKUP" || (address.street && address.number && address.neighborhood));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    createOrder.mutate({
      items: items.map(item => ({ productId: item.productId, quantity: item.quantity, addonOptionIds: item.addons.map(addon => addon.id), note: item.note })),
      fulfillmentType,
      deliveryRouteId: fulfillmentType === "DELIVERY" ? deliveryRouteId : undefined,
      paymentMethod,
      customer: { phone: normalizedPhone, name },
      address: fulfillmentType === "DELIVERY" ? address : undefined,
      changeForCents: changeForCentsValue,
      origin: "BALCAO",
      operationId: operationIdRef.current,
    });
  };

  return <>
    <Button onClick={() => setOpen(true)} className="h-10 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-2 h-4 w-4" />Novo pedido</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-[#fffdf8] sm:max-w-3xl">
        <DialogHeader><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Balcão</p><DialogTitle className="font-display text-3xl">Novo pedido</DialogTitle><p className="text-sm leading-6 text-muted-foreground">Para cliente que chegou no balcão ou ligou. Adicione os itens, dados e forma de entrega.</p></DialogHeader>
        <form onSubmit={submit} className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="min-w-0 space-y-4">
            <div><Label>Itens do pedido</Label><div className="mt-1.5"><ProductSearch onSelect={setSelectedProduct} /></div></div>
            <div className="rounded-xl border border-[#e4d8c8] bg-white p-3">
              {items.length ? <div className="space-y-2">{items.map(item => { const unit = item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0); return <div key={item.id} className="flex items-center gap-2 border-b border-[#f1e9dc] pb-2 last:border-0 last:pb-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p>{item.addons.map(addon => <p key={addon.id} className="text-xs text-muted-foreground">+ {addon.name}</p>)}</div><div className="flex items-center gap-1.5"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-sm">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Plus className="h-3 w-3" /></button></div><span className="w-16 shrink-0 text-right text-sm font-semibold">{money(unit * item.quantity)}</span><button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-red-600 hover:text-red-800" aria-label="Remover item"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div> : <p className="py-4 text-center text-sm text-muted-foreground">Nenhum item ainda. Busque um produto acima.</p>}
              {items.length > 0 && <div className="mt-3 flex items-center justify-between border-t border-[#eee4d8] pt-3"><button type="button" onClick={clearCart} className="text-xs font-semibold text-red-700 hover:underline">Limpar itens</button><span className="text-sm font-bold">Subtotal: {money(subtotalCents)}</span></div>}
            </div>
          </div>
          <div className="min-w-0 space-y-4">
            <div><Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />Telefone do cliente</Label><Input required value={phone} onChange={event => setPhone(event.target.value)} placeholder="(85) 99999-9999" className="mt-1.5 h-10 rounded-xl bg-white" />{lookup.isFetching && <p className="mt-1 text-xs text-muted-foreground">Consultando cadastro…</p>}{lookup.data && <p className="mt-1 text-xs text-emerald-700">Cliente encontrado: dados preenchidos automaticamente.</p>}</div>
            <div><Label>Nome</Label><Input required value={name} onChange={event => setName(event.target.value)} placeholder="Nome do cliente" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
            <div><Label>Entrega</Label><div className="mt-1.5 grid grid-cols-2 gap-2">{([["PICKUP", "Retirada no balcão"], ["DELIVERY", "Entrega"]] as const).map(([type, label]) => <button type="button" key={type} onClick={() => setFulfillmentType(type)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${fulfillmentType === type ? "border-primary bg-[#fdf1eb] text-[#9f3d26]" : "border-[#e0d5c5]"}`}>{label}</button>)}</div></div>
            {fulfillmentType === "DELIVERY" && <div className="space-y-3 rounded-xl border border-[#e4d8c8] bg-white p-3">
              {activeRoutes.length > 0 && <div><Label>Rota de entrega</Label><select required value={deliveryRouteId ?? ""} onChange={event => setDeliveryRouteId(event.target.value ? Number(event.target.value) : undefined)} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm"><option value="">Selecione a rota</option>{activeRoutes.map(route => <option key={route.id} value={route.id}>{route.name} · {money(route.deliveryFeeCents)}</option>)}</select></div>}
              <div className="grid grid-cols-3 gap-2"><div className="col-span-2"><Label>Rua</Label><Input required value={address.street} onChange={event => setAddress({ ...address, street: event.target.value })} className="mt-1.5 h-10 rounded-xl bg-white" /></div><div><Label>Número</Label><Input required value={address.number} onChange={event => setAddress({ ...address, number: event.target.value })} className="mt-1.5 h-10 rounded-xl bg-white" /></div></div>
              <div className="grid grid-cols-2 gap-2"><div><Label>Bairro</Label><Input required value={address.neighborhood} onChange={event => setAddress({ ...address, neighborhood: event.target.value })} className="mt-1.5 h-10 rounded-xl bg-white" /></div><div><Label>Complemento/referência</Label><Input value={address.complement} onChange={event => setAddress({ ...address, complement: event.target.value })} className="mt-1.5 h-10 rounded-xl bg-white" /></div></div>
              {addressLooksOutOfRoute && <p className="text-xs text-[#a43720]">Esse bairro não parece coincidir com a rota "{selectedRoute?.name}". Confira o endereço ou troque a rota.</p>}
            </div>}
            <div><Label>Pagamento</Label><div className="mt-1.5 grid grid-cols-3 gap-2">{([["PIX", "Pix"], ["CASH", "Dinheiro"], ["CARD_ON_DELIVERY", "Cartão"]] as const).map(([method, label]) => <button type="button" key={method} onClick={() => setPaymentMethod(method)} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${paymentMethod === method ? "border-primary bg-[#fdf1eb] text-[#9f3d26]" : "border-[#e0d5c5]"}`}>{label}</button>)}</div></div>
            {paymentMethod === "CASH" && <div><Label>Troco para quanto?</Label><Input inputMode="decimal" value={changeFor} onChange={event => setChangeFor(event.target.value)} placeholder="Ex.: 50,00" className="mt-1.5 h-10 rounded-xl bg-white" />{changeForInsufficient && <p className="mt-1 text-xs text-[#a43720]">O valor precisa ser igual ou maior que o total do pedido ({money(total)}).</p>}</div>}
            <div className="rounded-xl bg-[#17120e] p-4 text-[#fffaf3]"><div className="flex justify-between text-sm text-[#d2c4b0]"><span>Subtotal</span><span>{money(subtotalCents)}</span></div><div className="flex justify-between text-sm text-[#d2c4b0]"><span>Entrega</span><span>{deliveryFee ? money(deliveryFee) : "Grátis"}</span></div><div className="mt-2 flex justify-between border-t border-[#4a3d30] pt-2 text-base font-bold"><span>Total</span><span className="text-[#e9c98f]">{money(total)}</span></div></div>
            {isRetryingOffline(createOrder) ? <p className="text-sm text-amber-700">{createOrderStale ? "Conexão perdida há muito tempo — os preços podem ter mudado. Recarregue a página antes de continuar." : "Sem conexão. Tentando de novo…"}</p> : createOrder.error && <p className="text-sm text-red-700">{createOrder.error.message}</p>}
            <Button disabled={!canSubmit || createOrder.isPending} className="h-11 w-full rounded-xl bg-primary hover:bg-primary-hover"><ShoppingBag className="mr-2 h-4 w-4" />{isRetryingOffline(createOrder) ? "Tentando de novo…" : createOrder.isPending ? "Criando pedido…" : "Criar pedido"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ProductDialog product={selectedProduct} open={Boolean(selectedProduct)} onOpenChange={value => { if (!value) setSelectedProduct(null); }} />
  </>;
}
