import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import TeamLoginCard from "@/components/TeamLoginCard";
import { LockedFeatureFullPage } from "@/components/admin/LockedFeature";
import { trpc } from "@/lib/trpc";
import { PrepTimeProgress } from "@/components/PrepTimeProgress";
import { ArrowLeft, ChevronRight, Clock3, Loader2, LogOut, MessageSquareWarning, ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";

function Loading() { return <div className="grid min-h-screen place-items-center bg-[#f6f1e8]"><Loader2 className="h-8 w-8 animate-spin text-[#b4472d]" /></div>; }

function TeamLogin() {
  return <div className="grid min-h-screen place-items-center bg-[#f6f1e8] p-6"><div className="flex w-full max-w-md flex-col items-center"><TeamLoginCard title="Painel da cozinha" subtitle="Entre com o usuário e a senha cadastrados pelo responsável do MM System Creator." submitLabel="Entrar na cozinha" /><a href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#b4472d] hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para o site</a></div></div>;
}

const FULFILLMENT_LABEL = { DELIVERY: "Entrega", PICKUP: "Retirada", DINE_IN: "Mesa" } as const;

type KitchenOrder = { id: number; publicCode: string; customerName: string; fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN"; tableLabel: string | null; status: string; createdAt: number; acceptedAt: number | null; preparingAt: number | null; customerNote: string | null; items: Array<{ id: number; productName: string; quantity: number; note: string | null }> };

/** Próximo passo depois de "aceito"/"em produção" — mesma lógica de RestaurantOrders.tsx::OrderCard, só que a cozinha nunca decide "aceitar" (isso é do balcão/admin) nem "enviar pra entrega"/"concluir" depois de pronto (isso é do entregador/balcão) — o trabalho da cozinha acaba em "pronto". */
function nextKitchenStep(order: KitchenOrder) {
  if (order.status === "ACCEPTED") return { status: "PREPARING" as const, label: "Iniciar produção" };
  if (order.status === "PREPARING") {
    if (order.fulfillmentType === "DELIVERY") return { status: "OUT_FOR_DELIVERY" as const, label: "Pronto — enviar para entrega" };
    return { status: "READY_FOR_PICKUP" as const, label: order.fulfillmentType === "DINE_IN" ? "Pronto — servir na mesa" : "Pronto para retirada" };
  }
  return undefined;
}

function QueueCard({ order, position }: { order: KitchenOrder; position: number }) {
  const utils = trpc.useUtils();
  const updateStatus = trpc.admin.updateOrderStatus.useMutation({ onSuccess: () => void utils.admin.operationalSnapshot.invalidate() });
  const next = nextKitchenStep(order);
  const itemNotes = order.items.filter(item => item.note);
  return <article className="flex gap-4 rounded-2xl border border-[#e3d6c6] bg-[#fffdf8] p-4 shadow-[0_8px_20px_rgba(53,34,17,.06)] sm:p-5">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3e2d8] font-display text-lg font-bold text-[#b4472d]">{position}</span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-mono text-xs font-bold tracking-wide text-[#b4472d]">{order.publicCode}</p><h3 className="mt-0.5 font-display text-xl font-bold text-[#241b16]">{order.fulfillmentType === "DINE_IN" && order.tableLabel ? order.tableLabel : order.customerName}</h3><span className="text-xs font-semibold text-[#8a7a68]">{FULFILLMENT_LABEL[order.fulfillmentType]}</span></div>
        <div className="w-36"><PrepTimeProgress since={order.status === "PREPARING" ? (order.preparingAt ?? order.acceptedAt ?? order.createdAt) : (order.acceptedAt ?? order.createdAt)} label={order.status === "PREPARING" ? "Produção" : "Aceito"} orangeAtMinutes={order.status === "PREPARING" ? 20 : 5} redAtMinutes={order.status === "PREPARING" ? 40 : 10} /></div>
      </div>
      <ul className="mt-3 space-y-1 border-t border-[#eee4d8] pt-3 text-sm leading-6 text-[#3a2e24]">{order.items.map(item => <li key={item.id}><strong>{item.quantity}×</strong> {item.productName}</li>)}</ul>
      {(order.customerNote || itemNotes.length > 0) && <div className="mt-2 space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3"><div className="flex items-start gap-2 text-xs font-semibold text-amber-900"><MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div className="space-y-1">{order.customerNote && <p>{order.customerNote}</p>}{itemNotes.map(item => <p key={item.id} className="font-normal">{item.productName}: {item.note}</p>)}</div></div></div>}
      <div className="mt-4 flex items-center justify-between gap-3"><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Pedido às {new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>{next && <Button disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ orderId: order.id, status: next.status })} className="h-10 rounded-xl bg-[#b4472d] text-sm hover:bg-[#943722]">{updateStatus.isPending ? "Atualizando…" : next.label}<ChevronRight className="ml-1.5 h-4 w-4" /></Button>}</div>
      {updateStatus.error && <p className="mt-2 text-xs text-red-700">{updateStatus.error.message}</p>}
    </div>
  </article>;
}

/**
 * Tela dedicada da cozinha — só o que já foi aceito (a decisão de aceitar é
 * do balcão/admin, não da cozinha) e ainda não ficou pronto, numa fila ÚNICA
 * ordenada pela hora exata do pedido (não por coluna de status) — pra quem
 * está cozinhando seguir sempre a ordem de chegada real, sem furar fila.
 */
export default function Kitchen() {
  const [, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const canOperate = user?.role === "admin" || user?.role === "staff";
  const settings = trpc.catalog.settings.useQuery();
  const licenseSnapshot = trpc.admin.mySnapshot.useQuery(undefined, { enabled: canOperate });
  const locked = licenseSnapshot.data?.lockedFeatures.kitchen;
  const snapshot = trpc.admin.operationalSnapshot.useQuery(undefined, { enabled: canOperate && !locked, refetchInterval: 10000 });
  if (loading) return <Loading />;
  if (!canOperate) return <TeamLogin />;
  if (licenseSnapshot.isLoading) return <Loading />;
  const queue = locked ? [] : ((snapshot.data?.orders ?? []) as KitchenOrder[]).filter(order => order.status === "ACCEPTED" || order.status === "PREPARING").sort((a, b) => a.createdAt - b.createdAt);

  return <div className="min-h-screen bg-[#f6f1e8]">
    <header className="border-b border-[#3e3025] bg-[#17120e] text-[#fffaf3]"><div className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-3 py-3"><button onClick={() => setLocation("/")} className="flex items-center gap-2 font-display text-xl font-bold"><img src={settings.data?.logoUrl || "/mm-logo-icon.png"} alt="Logotipo MM System Creator" className="h-9 w-9 shrink-0 object-contain" />Cozinha</button><div className="flex items-center gap-2"><span className="hidden text-xs text-[#d6c5af] sm:block">Operador: {user?.name}</span><Button variant="outline" onClick={() => setLocation("/painel-pedidos")} className="h-9 rounded-lg border-[#665442] bg-transparent text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white">Painel de pedidos</Button><Button variant="outline" onClick={logout} className="h-9 rounded-lg border-[#665442] bg-transparent px-3 text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white"><LogOut className="h-3.5 w-3.5" /><span className="sr-only">Sair</span></Button></div></div></header>
    <main className="page-shell py-8 sm:py-10">
      {locked ? <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} featureId="kitchen" /> : <>
        <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b4472d]">Fila da cozinha</p><h1 className="mt-2 font-display text-4xl font-bold">Em ordem de chegada</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Pedidos já aceitos, do mais antigo pro mais novo — siga a numeração pra manter a fila justa.</p></div>
        {snapshot.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p className="font-semibold">Não foi possível carregar a fila.</p><p className="mt-1">{snapshot.error.message}</p></div>
          : queue.length ? <div className="space-y-4">{queue.map((order, index) => <QueueCard key={order.id} order={order} position={index + 1} />)}</div>
          : <div className="rounded-3xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-12 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-[#b89e7a]" /><h2 className="mt-4 font-display text-2xl font-bold">Nenhum pedido na fila agora.</h2><p className="mt-2 text-sm text-muted-foreground">Assim que um pedido for aceito, ele aparece aqui.</p></div>}
      </>}
    </main>
  </div>;
}
