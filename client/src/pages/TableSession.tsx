import { Button } from "@/components/ui/button";
import { CartProvider, useCart } from "@/contexts/CartContext";
import { CategoryProductSections, CategoryTabBar, useCategoryScrollSpy } from "@/components/CategoryScrollMenu";
import EmptyMenu from "@/components/EmptyMenu";
import ProductDialog from "@/components/ProductDialog";
import ProductSearch from "@/components/ProductSearch";
import { trpc } from "@/lib/trpc";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { generateClientId } from "@/lib/randomId";
import { isRetryingOffline, orderMutationRetryDelay, shouldRetryOrderMutation } from "@/lib/offlineRetry";
import { clearPendingOrder, persistPendingOrder, resumeOrCreateOperationId, PENDING_ORDER_SCHEMA_VERSION } from "@/lib/pendingOrderQueue";
import { isMarcaBackground, MARCA_GRADIENT } from "@shared/colorThemes";
import { ArrowLeft, BellRing, Loader2, Minus, Plus, ReceiptText, ShoppingBag, Trash2, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRoute } from "wouter";
import type { MenuCategory, MenuProduct } from "@/lib/menuTypes";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const STATUS_LABEL: Record<string, string> = { PENDING: "Aguardando aceite", ACCEPTED: "Aceito pela cozinha", PREPARING: "Em preparo", READY_FOR_PICKUP: "Pronto — a caminho da mesa", COMPLETED: "Servido", CANCELLED: "Cancelado" };

function Loading() { return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>; }

/**
 * Tela inicial ao ler o QR Code da mesa — logo do restaurante + 3 ações
 * diretas, em vez de já cair direto na busca de produtos. "Chamar garçom" e
 * "Pedir a conta" agem na hora, sem precisar entrar na tela de pedido.
 */
function TableLanding({ token, onOrder }: { token: string; onOrder: () => void }) {
  const utils = trpc.useUtils();
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);
  const resolve = trpc.table.resolve.useQuery({ token }, { refetchInterval: 12000 });
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
    return <div className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><UtensilsCrossed className="mx-auto h-9 w-9 text-[#b89e7a]" /><h1 className="mt-4 font-display text-2xl font-bold">Mesa não encontrada</h1><p className="mt-2 max-w-sm text-sm text-muted-foreground">{resolve.error?.message ?? "Confira o QR Code ou peça ajuda à equipe."}</p></div></div>;
  }
  const { table, waiterRequested, session } = resolve.data;
  const billRequested = session.status === "AWAITING_PAYMENT";

  return <div className="grid min-h-screen place-items-center bg-background p-6" style={marca ? { background: MARCA_GRADIENT } : undefined}><div className="w-full max-w-sm text-center">
    <img src={settings.data?.logoUrl || "/mm-logo-icon.png"} alt="Logotipo do restaurante" className="mx-auto h-16 w-16 object-contain" />
    <p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-primary">{table.sector || "Salão"}</p>
    <h1 className="mt-1 font-display text-3xl font-bold">{table.label}</h1>
    <p className="mt-2 text-sm text-muted-foreground">O que você quer fazer?</p>
    <div className="mt-6 space-y-3">
      <button type="button" onClick={onOrder} className="flex w-full items-center gap-3 rounded-2xl border border-[#e0d5c5] bg-[#fffdf8] p-4 text-left text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)] transition hover:border-primary hover:bg-[#fdf1eb]"><img src="/mesa-cardapio-icon.png" alt="" className="h-10 w-10 shrink-0 object-contain" /><span><span className="block text-sm font-bold">Ver cardápio e pedir</span><span className="block text-xs text-[#8a7a68]">Busque os itens e envie seu pedido pra cozinha</span></span></button>
      <button type="button" disabled={waiterRequested || callWaiter.isPending} onClick={() => callWaiter.mutate({ token })} className="flex w-full items-center gap-3 rounded-2xl border border-[#e0d5c5] bg-[#fffdf8] p-4 text-left text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)] transition hover:border-primary hover:bg-[#fdf1eb] disabled:opacity-60"><img src="/mesa-garcom-icon.png" alt="" className="h-10 w-10 shrink-0 object-contain" /><span><span className="block text-sm font-bold">{waiterRequested ? "Garçom já chamado" : callWaiter.isPending ? "Chamando…" : "Chamar garçom"}</span><span className="block text-xs text-[#8a7a68]">Alguém da equipe vem até a mesa</span></span></button>
      <button type="button" disabled={billRequested || requestBill.isPending} onClick={() => requestBill.mutate({ token })} className="flex w-full items-center gap-3 rounded-2xl border border-[#e0d5c5] bg-[#fffdf8] p-4 text-left text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)] transition hover:border-primary hover:bg-[#fdf1eb] disabled:opacity-60"><img src="/mesa-comanda-icon.jpg" alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" /><span><span className="block text-sm font-bold">{billRequested ? "Conta já solicitada" : requestBill.isPending ? "Chamando…" : "Pedir a conta"}</span><span className="block text-xs text-[#8a7a68]">Fecha tudo que já foi pedido nessa mesa</span></span></button>
    </div>
  </div></div>;
}

function TableSessionContent({ token, onBack }: { token: string; onBack: () => void }) {
  const utils = trpc.useUtils();
  const resolve = trpc.table.resolve.useQuery({ token }, { refetchInterval: 12000 });
  const catalog = trpc.catalog.list.useQuery();
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);
  const categories = (catalog.data ?? []) as MenuCategory[];
  const scrollSpy = useCategoryScrollSpy(categories);
  const { items, subtotalCents, updateQuantity, removeItem, clearCart } = useCart();
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null);
  const [showCart, setShowCart] = useState(false);

  // Uma mesa manda várias rodadas na mesma sessão — regenerar só no sucesso
  // evita que a rodada seguinte seja tratada como duplicata da anterior (ver
  // comentário em insertPricedOrder, server/routers/order.ts). A semente
  // reusa uma pendência salva (F5 com rodada pausada) em vez de sempre gerar
  // um id novo — ver client/src/lib/pendingOrderQueue.ts.
  const operationIdRef = useRef(resumeOrCreateOperationId({ type: "table.addRound", token }));
  const addRound = trpc.table.addRound.useMutation({
    retry: shouldRetryOrderMutation,
    retryDelay: orderMutationRetryDelay,
    onMutate: variables => persistPendingOrder({ type: "table.addRound", token, payload: variables, createdAt: Date.now(), itemCount: items.length, schemaVersion: PENDING_ORDER_SCHEMA_VERSION }),
    onSettled: () => clearPendingOrder({ type: "table.addRound", token }),
    onSuccess: () => {
      operationIdRef.current = generateClientId();
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
    return <div className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><UtensilsCrossed className="mx-auto h-9 w-9 text-[#b89e7a]" /><h1 className="mt-4 font-display text-2xl font-bold">Mesa não encontrada</h1><p className="mt-2 max-w-sm text-sm text-muted-foreground">{resolve.error?.message ?? "Confira o QR Code ou peça ajuda à equipe."}</p></div></div>;
  }

  const { table, orders, totalCents, balanceDueCents, session, waiterRequested } = resolve.data;
  const billRequested = session.status === "AWAITING_PAYMENT";
  const submitRound = () => {
    if (!items.length) return;
    addRound.mutate({ token, items: items.map(item => ({ productId: item.productId, quantity: item.quantity, addonOptionIds: item.addons.map(addon => addon.id), note: item.note })), operationId: operationIdRef.current });
  };
  const roundLabel = isRetryingOffline(addRound) ? "Sem conexão, tentando de novo…" : addRound.isPending ? "Enviando…" : "Enviar pedido";

  return <div className="min-h-screen bg-background pb-28" style={marca ? { background: MARCA_GRADIENT } : undefined}>
    <header className="border-b border-[#3e3025] bg-[#17120e] text-[#fffaf3]"><div className="page-shell flex min-h-16 items-center justify-between py-3"><div className="flex items-center gap-3"><button type="button" onClick={onBack} aria-label="Voltar" className="rounded-lg p-1.5 hover:bg-white/10"><ArrowLeft className="h-4 w-4" /></button><div className="flex items-center gap-2 font-display text-xl font-bold"><UtensilsCrossed className="h-5 w-5 text-[#e9c98f]" />{table.label}</div></div><span className="text-xs text-[#d6c5af]">{table.sector || "Salão"}</span></div></header>
    <main className="page-shell max-w-2xl py-7">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Peça direto da mesa</p>
      <h1 className="mt-2 font-display text-3xl font-bold">O que vamos pedir?</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Busque um item, adicione ao pedido e envie. Você pode fazer quantas rodadas quiser — a conta fecha tudo junto no final.</p>
      {categories.length ? <div className="mt-4"><CategoryTabBar categories={categories} spy={scrollSpy} marca={marca} /></div> : null}
      <div className="mt-4"><ProductSearch onSelect={setSelectedProduct} /></div>
      <Button type="button" variant="outline" disabled={waiterRequested || callWaiter.isPending} onClick={() => callWaiter.mutate({ token })} className="mt-3 h-10 w-full rounded-xl border-[#d9c9b4] bg-white text-[#231d18] sm:w-auto"><BellRing className="mr-2 h-4 w-4" />{waiterRequested ? "Garçom já chamado" : callWaiter.isPending ? "Chamando…" : "Chamar garçom"}</Button>

      <div className="mt-6">{categories.length ? <CategoryProductSections categories={categories} spy={scrollSpy} onSelect={setSelectedProduct} /> : !catalog.isLoading ? <EmptyMenu openingHours={undefined} /> : null}</div>

      {orders.length > 0 && <section className="mt-8"><h2 className="font-display text-xl font-bold">Sua comanda</h2><div className="mt-3 space-y-3">{orders.map(order => <div key={order.id} className="rounded-2xl border border-[#e3d6c6] bg-[#fffdf8] p-4 text-[#231d18]"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-[.1em] text-primary">{STATUS_LABEL[order.status] ?? order.status}</span><strong className="text-sm">{money(order.totalCents)}</strong></div><p className="mt-2 text-xs leading-5 text-[#695b50]">{order.items.map(item => `${item.quantity}× ${item.productName}`).join(" · ")}</p></div>)}</div></section>}

      <div className="mt-8 rounded-2xl bg-[#17120e] p-5 text-[#fffaf3]"><div className="flex justify-between text-sm text-[#d2c4b0]"><span>Total da comanda</span><span>{money(totalCents)}</span></div>{balanceDueCents !== totalCents && <div className="mt-1 flex justify-between text-xs text-[#a7c9ab]"><span>Já pago</span><span>{money(totalCents - balanceDueCents)}</span></div>}<div className="mt-3 flex items-center justify-between border-t border-[#4a3d30] pt-3"><Button type="button" variant="outline" disabled={billRequested || requestBill.isPending} onClick={() => requestBill.mutate({ token })} className="h-10 rounded-xl border-[#5c4b3a] bg-transparent text-xs text-[#fffaf3] hover:bg-[#2c241a]"><ReceiptText className="mr-2 h-3.5 w-3.5" />{billRequested ? "Conta já solicitada" : requestBill.isPending ? "Chamando…" : "Pedir a conta"}</Button></div></div>
    </main>

    {items.length > 0 && <div className="fixed inset-x-0 bottom-0 border-t border-[#3e3025] bg-[#17120e] p-4 text-[#fffaf3]"><div className="page-shell flex items-center justify-between gap-3"><button type="button" onClick={() => setShowCart(true)} className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-[#e9c98f]" />{items.reduce((sum, item) => sum + item.quantity, 0)} item(ns) · {money(subtotalCents)}</button><Button disabled={addRound.isPending} onClick={submitRound} className="h-10 rounded-xl bg-primary hover:bg-primary-hover">{roundLabel}</Button></div></div>}

    {showCart && <div className="fixed inset-0 z-40 grid place-items-end bg-black/40 sm:place-items-center" onClick={() => setShowCart(false)}><div className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-[#fffdf8] p-5 text-[#231d18] sm:max-w-md sm:rounded-2xl" onClick={event => event.stopPropagation()}><h2 className="font-display text-xl font-bold">Seu pedido</h2><div className="mt-4 space-y-2">{items.map(item => { const unit = item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0); return <div key={item.id} className="flex items-center gap-2 border-b border-[#f1e9dc] pb-2 last:border-0 last:pb-0"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p>{item.addons.map(addon => <p key={addon.id} className="text-xs text-[#8a7a68]">+ {addon.name}</p>)}</div><div className="flex items-center gap-1.5"><button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Minus className="h-3 w-3" /></button><span className="w-5 text-center text-sm">{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="rounded-md border p-1 hover:bg-[#f3ece1]"><Plus className="h-3 w-3" /></button></div><span className="w-16 shrink-0 text-right text-sm font-semibold">{money(unit * item.quantity)}</span><button type="button" onClick={() => removeItem(item.id)} className="shrink-0 text-red-600 hover:text-red-800" aria-label="Remover item"><Trash2 className="h-3.5 w-3.5" /></button></div>; })}</div><div className="mt-4 flex items-center justify-between"><span className="text-sm font-bold">Subtotal: {money(subtotalCents)}</span><Button disabled={addRound.isPending} onClick={submitRound} className="h-10 rounded-xl bg-primary hover:bg-primary-hover">{roundLabel}</Button></div>{isRetryingOffline(addRound) ? <p className="mt-2 text-xs text-amber-700">Sem conexão. Tentando de novo…</p> : addRound.error && <p className="mt-2 text-xs text-red-700">{addRound.error.message}</p>}</div></div>}
    <ProductDialog product={selectedProduct} open={Boolean(selectedProduct)} onOpenChange={value => { if (!value) setSelectedProduct(null); }} />
  </div>;
}

function TableSessionRoot({ token }: { token: string }) {
  const [stage, setStage] = useState<"landing" | "ordering">("landing");
  if (stage === "landing") return <TableLanding token={token} onOrder={() => setStage("ordering")} />;
  return <TableSessionContent token={token} onBack={() => setStage("landing")} />;
}

export default function TableSession() {
  const [, params] = useRoute<{ token: string }>("/mesa/:token");
  if (!params?.token) return <Loading />;
  return <CartProvider storageKey={`mm-table-cart-${params.token}`}><TableSessionRoot token={params.token} /></CartProvider>;
}
