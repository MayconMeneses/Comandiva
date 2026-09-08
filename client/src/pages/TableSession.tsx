import { Button } from "@/components/ui/button";
import { CartProvider, useCart } from "@/contexts/CartContext";
import ProductDialog from "@/components/ProductDialog";
import ProductSearch from "@/components/ProductSearch";
import { trpc } from "@/lib/trpc";
import { BellRing, Loader2, Minus, Plus, ReceiptText, ShoppingBag, Trash2, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRoute } from "wouter";
import type { MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const STATUS_LABEL: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Aceito pela cozinha", PREPARING: "Em preparo", READY_FOR_PICKUP: "Pronto — a caminho da mesa", COMPLETED: "Servido", CANCELLED: "Cancelado" };

function Loading() { return <div className="grid min-h-screen place-items-center bg-[#f6f1e8]"><Loader2 className="h-8 w-8 animate-spin text-[#b4472d]" /></div>; }

function TableSessionContent({ token }: { token: string }) {
  const utils = trpc.useUtils();
  const resolve = trpc.table.resolve.useQuery({ token }, { refetchInterval: 12000 });
  const { items, subtotalCents, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [showCart, setShowCart] = useState(false);

  const addRound = trpc.table.addRound.useMutation({
    onSuccess: () => {
      clearCart();
      setShowCart(false);
      void utils.table.resolve.invalidate({ token });
      toast.success("Pedido enviado para a cozinha!");
    },
    onError: error => toast.error(error.message),
  });
  const requestBill = trpc.table.requestBill.useMutation({
    onSuccess: () => { void utils.table.resolve.invalidate({ token }); toast.success("Conta solicitada. A equipe já foi avisada."); },
    onError: error => toast.error(error.message),
  });
  const callWaiter = trpc.table.callWaiter.useMutation({
    onSuccess: () => { void utils.table.resolve.invalidate({ token }); toast.success("Garçom chamado! Já estamos indo até a mesa."); },
    onError: error => toast.error(error.message),
  });

  if (resolve.isLoading) return <Loading />;
  if (resolve.error || !resolve.data) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f1e8] p-6 text-center"><div><UtensilsCrossed className="mx-auto h-9 w-9 text-[#b89e7a]" /><h1 className="mt-4 font-display text-2xl font-bold">Mesa não encontrada</h1><p className="mt-2 max-w-sm text-sm text-muted-foreground">{resolve.error?.message ?? "Confira o QR Code ou peça ajuda à equipe."}</p></div></div>;
  }

  const { table, orders, totalCents, balanceDueCents, session, waiterRequested } = resolve.data;
  const billRequested = session.status === "AWAITING_PAYMENT";
  const submitRound = () => {
    if (!items.length) return;
    addRound.mutate({ token, items: items.map(item => ({ productId: item.productId, quantity: item.quantity, addonOptionIds: item.addons.map(addon => addon.id), note: item.note })) });
  };

  return <div className="min-h-screen bg-[#f6f1e8] pb-28">
    <header className="border-b border-[#3e3025] bg-[#17120e] text-[#fffaf3]"><div className="page-shell flex min-h-16 items-center justify-between py-3"><div className="flex items-center gap-2 font-display text-xl font-bold"><UtensilsCrossed className="h-5 w-5 text-[#e9c98f]" />{table.label}</div><span className="text-xs text-[#d6c5af]">{table.sector || "Salão"}</span></div></header>
    <main className="page-shell max-w-2xl py-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#b4472d]">Peça direto da mesa</p>
      <h1 className="mt-2 font-display text-3xl font-bold">O que vamos pedir?</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Busque um item, adicione ao pedido e envie. Você pode fazer quantas rodadas quiser — a conta fecha tudo junto no final.</p>
      <div className="mt-5"><ProductSearch onSelect={setSelectedProduct} /></div>
      <Button type="button" variant="outline" disabled={waiterRequested || callWaiter.isPending} onClick={() => callWaiter.mutate({ token })} className="mt-3 h-10 w-full rounded-xl border-[#d9c9b4] bg-white sm:w-auto"><BellRing className="mr-2 h-4 w-4" />{waiterRequested ? "Garçom já chamado" : callWaiter.isPending ? "Chamando…" : "Chamar garçom"}</Button>

      {orders.length > 0 && <section className="mt-8"><h2 className="font-display text-xl font-bold">Sua comanda</h2><div className="mt-3 space-y-3">{orders.map(order => <div key={order.id} className="rounded-2xl border border-[#e3d6c6] bg-[#fffdf8] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[.1em] text-[#b4472d]">{STATUS_LABEL[order.status] ?? order.status}</span><strong className="text-sm">{money(order.totalCents)}</strong></div><p className="mt-2 text-xs leading-5 text-[#695b50]">{order.items.map(item => `${item.quantity}× ${item.productName}`).join(" · ")}</p></div>)}</div></section>}

      <div className="mt-8 rounded-2xl bg-[#17120e] p-5 text-[#fffaf3]"><div className="flex justify-between text-sm text-[#d2c4b0]"><span>Total da comanda</span><span>{money(totalCents)}</span></div>{balanceDueCents !== totalCents && <div className="mt-1 flex justify-between text-xs text-[#a7c9ab]"><span>Já pago</span><span>{money(totalCents - balanceDueCents)}</span></div>}<div className="mt-3 flex items-center justify-between border-t border-[#4a3d30] pt-3"><Button type="button" variant="outline" disabled={billRequested || requestBill.isPending} onClick={() => requestBill.mutate({ token })} className="h-10 rounded-xl border-[#5c4b3a] bg-transparent text-xs text-[#fffaf3] hover:bg-[#2c241a]"><ReceiptText className="mr-2 h-3.5 w-3.5" />{billRequested ? "Conta já solicitada" : requestBill.isPending ? "Chamando…" : "Pedir a conta"}</Button></div></div>
    </main>

    {items.length > 0 && <div className="fixed inset-x-0 bottom-0 border-t border-[#3e3025] bg-[#17120e] p-4 text-[#fffaf3]"><div className="page-shell flex items-center justify-between gap-3"><button type="button" onClick={() => setShowCart(true)} className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-[#e9c98f]" />{items.reduce((sum, item) => sum + item.quantity, 0)} item(ns) · {money(subtotalCents)}</button><Button disabled={addRound.isPending} onClick={submitRound} className="h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{addRound.isPending ? "Enviando…" : "Enviar pedido"}</Button></div></div>}

    {showCart && <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setShowCart(false)}><div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-[#fffdf8] p-5 sm:max-w-md sm:rounded-2xl" onClick={event => event.stopPropagation()}><h2 className="font-display text-xl font-bold">Seu pedido</h2><div className="mt-4 space-y-2">{items.map(item => { const unit = item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0); return <div key={item.id} className="flex items-center gap-2 border-b border-[#f1e9dc] pb-2 last:border-0 last:pb-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p>{item.addons.map(addon => <p key={addon.id} className="text-xs text-muted-foreground">+ {addon.name}</p>)}</div><div className="flex items-center gap-1.5"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-sm">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Plus className="h-3 w-3" /></button></div><span className="w-16 shrink-0 text-right text-sm font-semibold">{money(unit * item.quantity)}</span><button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-red-600 hover:text-red-800" aria-label="Remover item"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div><div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold">Subtotal: {money(subtotalCents)}</span><Button disabled={addRound.isPending} onClick={submitRound} className="h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]">{addRound.isPending ? "Enviando…" : "Enviar pedido"}</Button></div>{addRound.error && <p className="mt-2 text-xs text-red-700">{addRound.error.message}</p>}</div></div>}
    <ProductDialog product={selectedProduct} open={Boolean(selectedProduct)} onOpenChange={value => { if (!value) setSelectedProduct(null); }} />
  </div>;
}

export default function TableSession() {
  const [, params] = useRoute<{ token: string }>("/mesa/:token");
  if (!params?.token) return <Loading />;
  return <CartProvider storageKey={`pubx-table-cart-${params.token}`}><TableSessionContent token={params.token} /></CartProvider>;
}
