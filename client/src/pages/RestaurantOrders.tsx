import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CollapsibleSection from "@/components/CollapsibleSection";
import NewCounterOrder from "@/components/NewCounterOrder";
import TableMapManager from "@/components/TableMapManager";
import TeamLoginCard from "@/components/TeamLoginCard";
import { LockedFeatureFullPage } from "@/components/admin/LockedFeature";
import { trpc } from "@/lib/trpc";
import { getDeviceId } from "@/lib/deviceId";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, CookingPot, Loader2, LogOut, MapPinned, MessageSquareWarning, PackageCheck, Phone, Plus, Printer, RefreshCw, ShieldCheck, ShoppingBag, UserCog } from "lucide-react";
import { FormEvent, useState } from "react";
import { PrepTimeProgress } from "@/components/PrepTimeProgress";
import { useLocation } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const statusMeta = {
  PENDING: { title: "Aguardando aceite", description: "Pedidos novos aguardando confirmação.", icon: ShoppingBag, tone: "border-amber-200 bg-amber-50", next: { status: "ACCEPTED" as const, label: "Aceitar pedido" } },
  ACCEPTED: { title: "Aceitos", description: "Pedidos confirmados, prontos para iniciar.", icon: CheckCircle2, tone: "border-sky-200 bg-sky-50", next: { status: "PREPARING" as const, label: "Iniciar produção" } },
  PREPARING: { title: "Em produção", description: "Pedidos em preparo na cozinha.", icon: CookingPot, tone: "border-violet-200 bg-violet-50", next: undefined },
  OUT_FOR_DELIVERY: { title: "Em rota de entrega", description: "Pedidos enviados para o cliente.", icon: MapPinned, tone: "border-indigo-200 bg-indigo-50", next: { status: "COMPLETED" as const, label: "Concluir entrega" } },
  READY_FOR_PICKUP: { title: "Prontos para retirada", description: "Pedidos disponíveis no balcão.", icon: PackageCheck, tone: "border-emerald-200 bg-emerald-50", next: { status: "COMPLETED" as const, label: "Concluir retirada" } },
} as const;
type ActiveStatus = keyof typeof statusMeta;

function Loading() { return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>; }

function TeamLogin() {
  return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="flex w-full max-w-md flex-col items-center"><TeamLoginCard title="Painel de pedidos" subtitle="Entre com o usuário e a senha cadastrados pelo responsável do MM System Creator." submitLabel="Entrar nos pedidos" /><a href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para o site</a></div></div>;
}

function StaffAccessManager() {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const utils = trpc.useUtils(); const accounts = trpc.team.list.useQuery(undefined, { enabled: open });
  const create = trpc.team.create.useMutation({ onSuccess: () => { setName(""); setUsername(""); setPassword(""); void accounts.refetch(); } });
  const setActive = trpc.team.setActive.useMutation({ onSuccess: () => void accounts.refetch() });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ name, username, password }); };
  return <><Button variant="outline" onClick={() => setOpen(true)} className="h-9 rounded-lg border-[#665442] bg-transparent text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white"><UserCog className="mr-1.5 h-4 w-4" />Acessos da equipe</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-[#fffdf8] sm:max-w-2xl"><DialogHeader><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Segurança operacional</p><DialogTitle className="font-display text-3xl">Acessos da equipe</DialogTitle><p className="text-sm leading-6 text-muted-foreground">Crie credenciais para a equipe operar os pedidos sem usar sua conta Local. Essas contas não têm acesso ao cardápio, clientes ou relatórios administrativos.</p></DialogHeader><form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border border-[#e2d5c5] bg-[#fbf6ee] p-4 sm:grid-cols-2"><div><Label htmlFor="staff-name">Nome da pessoa</Label><Input id="staff-name" required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Ana - Cozinha" className="mt-2 h-10 rounded-xl bg-white" /></div><div><Label htmlFor="new-staff-username">Usuário</Label><Input id="new-staff-username" required value={username} onChange={event => setUsername(event.target.value)} placeholder="Ex.: cozinha.mm" className="mt-2 h-10 rounded-xl bg-white" /></div><div className="sm:col-span-2"><Label htmlFor="new-staff-password">Senha provisória</Label><Input id="new-staff-password" required type="password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" className="mt-2 h-10 rounded-xl bg-white" /></div>{create.error ? <p className="sm:col-span-2 text-sm text-red-700">{create.error.message}</p> : null}<Button disabled={create.isPending} className="sm:col-span-2 h-10 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-1.5 h-4 w-4" />{create.isPending ? "Criando acesso…" : "Cadastrar acesso"}</Button></form><div className="mt-6"><h3 className="font-semibold">Contas cadastradas</h3>{accounts.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Carregando acessos…</p> : accounts.data?.length ? <div className="mt-3 space-y-2">{accounts.data.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7dbcc] p-3"><div><p className="font-semibold">{account.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Usuário: {account.username}{account.lastSignedInAt ? ` · último acesso em ${new Date(account.lastSignedInAt).toLocaleString("pt-BR")}` : " · ainda não acessou"}</p></div><div className="flex items-center gap-2"><span className="text-xs font-medium text-muted-foreground">{account.active ? "Ativo" : "Pausado"}</span><Switch checked={account.active} onCheckedChange={active => setActive.mutate({ accountId: account.id, active })} aria-label={`Alternar acesso de ${account.name}`} /></div></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Nenhum acesso próprio cadastrado ainda.</p>}</div></DialogContent></Dialog></>;
}

const FULFILLMENT_LABEL = { DELIVERY: "Entrega", PICKUP: "Retirada", DINE_IN: "Mesa" } as const;

const ORIGIN_TAG: Record<string, string> = { GARCOM: "Garçom", QR_CODE: "QR Code", BALCAO: "Balcão" };

// Comanda (sempre, no aceite) e DANFE (delivery/retirada, ao sair/ficar
// pronto — ver "Quando emitir" no plano de emissão de NFC-e) imprimem
// sozinhos nesses 3 momentos, reaproveitando a mesma tela de comprovante que
// já existia só pra reimpressão manual (Receipt.tsx, ?autoprint=1 dispara
// window.print() sozinho lá). Mesa não entra aqui — o fechamento da comanda
// (TableMapManager) é quem dispara a impressão dela, consolidada.
const AUTO_PRINT_STATUSES = new Set(["ACCEPTED", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP"]);

function OrderCard({ order }: { order: { id: number; publicCode: string; customerName: string; customerPhone: string; fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN"; origin: string; tableLabel: string | null; status: string; totalCents: number; createdAt: number; acceptedAt: number | null; preparingAt: number | null; customerNote: string | null; items: Array<{ id: number; productName: string; quantity: number; note: string | null }> } }) {
  // onError também invalida (não só onSuccess): num CONFLICT (outro
  // dispositivo já mudou o pedido — ver updateOrderStatus, server/routers/
  // admin/orders.ts), a tela deste dispositivo ficaria mostrando o status
  // desatualizado até o próximo poll (até 10s) se não recarregasse na hora.
  const utils = trpc.useUtils(); const updateStatus = trpc.admin.updateOrderStatus.useMutation({ onSuccess: () => void utils.admin.operationalSnapshot.invalidate(), onError: () => void utils.admin.operationalSnapshot.invalidate() }); const meta = statusMeta[order.status as ActiveStatus]; if (!meta) return null;
  const next = order.status === "PREPARING"
    ? order.fulfillmentType === "DELIVERY" ? { status: "OUT_FOR_DELIVERY" as const, label: "Enviar para entrega" }
    : order.fulfillmentType === "DINE_IN" ? { status: "READY_FOR_PICKUP" as const, label: "Pronto para servir" }
    : { status: "READY_FOR_PICKUP" as const, label: "Pronto para retirada" }
    : order.status === "READY_FOR_PICKUP" && order.fulfillmentType === "DINE_IN" ? { status: "COMPLETED" as const, label: "Marcar como servido" }
    : meta.next;
  const itemNotes = order.items.filter(item => item.note);
  const advance = () => {
    if (!next) return;
    // Abre a aba em branco AQUI (síncrono, dentro do clique — gesto real do
    // usuário) e só navega ela pra URL de verdade depois que a mutation
    // responder — abrir depois, dentro do onSuccess assíncrono, é bloqueado
    // pelo navegador por não contar mais como gesto do usuário (mesmo
    // problema já visto com pop-up do Modo Suporte no Painel Master).
    const printTab = AUTO_PRINT_STATUSES.has(next.status) ? window.open("", "_blank") : null;
    updateStatus.mutate({ orderId: order.id, status: next.status, expectedStatus: order.status as ActiveStatus, deviceId: getDeviceId() }, {
      onSuccess: () => { if (printTab) printTab.location.href = `/admin/comprovante/${order.id}?autoprint=1`; },
      onError: () => printTab?.close(),
    });
  };
  return <article className="rounded-2xl border border-[#e3d6c6] bg-[#fffdf8] p-4 shadow-[0_8px_20px_rgba(53,34,17,.06)]"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold tracking-wide text-primary">{order.publicCode}</p><h3 className="mt-1 font-display text-xl font-bold text-[#241b16]">{order.fulfillmentType === "DINE_IN" && order.tableLabel ? order.tableLabel : order.customerName}</h3></div><strong className="text-sm text-[#241b16]">{money(order.totalCents)}</strong></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{order.customerPhone}</span><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>{order.status === "PENDING"
  ? <div className="mt-3"><PrepTimeProgress since={order.createdAt} label="Aceite" /></div>
  : order.status === "ACCEPTED"
  ? <div className="mt-3"><PrepTimeProgress since={order.acceptedAt ?? order.createdAt} orangeAtMinutes={5} redAtMinutes={10} /></div>
  : <div className="mt-3"><PrepTimeProgress since={order.preparingAt ?? order.acceptedAt ?? order.createdAt} label="Produção" orangeAtMinutes={20} redAtMinutes={40} /></div>}<p className="mt-3 line-clamp-2 border-t border-[#eee4d8] pt-3 text-xs leading-5 text-[#695b50]">{order.items.map(item => `${item.quantity}× ${item.productName}`).join(" · ")}</p>{(order.customerNote || itemNotes.length > 0) && <div className="mt-2 space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3"><div className="flex items-start gap-2 text-xs font-semibold text-amber-900"><MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div className="space-y-1"> {order.customerNote && <p>{order.customerNote}</p>} {itemNotes.map(item => <p key={item.id} className="font-normal">{item.productName}: {item.note}</p>)}</div></div></div>}<div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#695b50]">{FULFILLMENT_LABEL[order.fulfillmentType]}{ORIGIN_TAG[order.origin] ? ` · ${ORIGIN_TAG[order.origin]}` : ""}</span><div className="flex items-center gap-2">{order.status !== "PENDING" && <button type="button" onClick={() => window.open(`/admin/comprovante/${order.id}`, "_blank", "noopener,noreferrer")} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d9c9b4] text-[#725645] transition hover:border-primary hover:text-primary" aria-label="Imprimir comprovante"><Printer className="h-4 w-4" /></button>}{next ? <Button size="sm" disabled={updateStatus.isPending} onClick={advance} className="h-9 rounded-lg bg-primary text-xs hover:bg-primary-hover">{updateStatus.isPending ? "Atualizando…" : next.label}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button> : null}</div></div>{updateStatus.error ? <p className="mt-3 text-xs text-red-700">{updateStatus.error.message}</p> : null}</article>;
}

export default function RestaurantOrders() {
  const [, setLocation] = useLocation(); const { user, loading, logout } = useAuth(); const canOperate = user?.role === "admin" || user?.role === "staff";
  // Modo Suporte também recebe role "admin" sintético (ver server/routers.ts
  // auth.me) — sem essa checagem, "Acessos da equipe" aparecia aqui mesmo em
  // sessão de suporte, e team.list (adminOnlyProcedure) só ia falhar depois,
  // na hora de carregar. Mesmo padrão já usado em DashboardLayout.tsx.
  const isRealAdmin = user?.role === "admin" && !("viaSupportSession" in user && user.viaSupportSession);
  // Consultado junto com TableMapManager (mesma tela, mesmo intervalo) — o
  // React Query compartilha a mesma chamada de rede entre os componentes
  // automaticamente, DESDE que o input seja idêntico em todo mundo (por isso
  // `undefined` aqui, não `{ordersLimit:80}` — o padrão de 80 já vem do
  // schema no servidor; um input diferente quebraria o compartilhamento).
  const licenseSnapshot = trpc.admin.mySnapshot.useQuery(undefined, { enabled: canOperate });
  const locked = licenseSnapshot.data?.lockedFeatures.kitchen;
  const snapshot = trpc.admin.operationalSnapshot.useQuery(undefined, { enabled: canOperate && !licenseSnapshot.isLoading && !locked, refetchInterval: 10000 });
  const orders = { data: snapshot.data?.orders, isLoading: snapshot.isLoading, isFetching: snapshot.isFetching, error: snapshot.error, refetch: snapshot.refetch };
  const settings = trpc.catalog.settings.useQuery();
  if (loading) return <Loading />;
  if (!canOperate) return <TeamLogin />;
  if (licenseSnapshot.isLoading) return <Loading />;
  const operationalOrders = locked ? [] : (orders.data ?? []).filter(order => Object.prototype.hasOwnProperty.call(statusMeta, order.status));
  return <div className="min-h-screen bg-background"><header className="border-b border-[#3e3025] bg-[#17120e] text-[#fffaf3]"><div className="page-shell flex min-h-16 flex-wrap items-center justify-between gap-3 py-3"><button onClick={() => setLocation("/")} className="flex items-center gap-2 font-display text-xl font-bold"><img src={settings.data?.logoUrl || "/mm-logo-icon.png"} alt="Logotipo MM System Creator" className="h-9 w-9 shrink-0 object-contain" />MM System Creator</button><div className="flex items-center gap-2"><span className="hidden text-xs text-[#d6c5af] sm:block">Operador: {user?.name}</span><Button variant="outline" onClick={() => setLocation("/cozinha")} className="h-9 rounded-lg border-[#665442] bg-transparent text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white">Cozinha</Button>{isRealAdmin ? <><StaffAccessManager /><Button variant="outline" onClick={() => setLocation("/admin")} className="h-9 rounded-lg border-[#665442] bg-transparent text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white">Painel completo</Button></> : null}<Button variant="outline" onClick={logout} className="h-9 rounded-lg border-[#665442] bg-transparent px-3 text-xs text-[#fffaf3] hover:bg-[#30241d] hover:text-white"><LogOut className="h-3.5 w-3.5" /><span className="sr-only">Sair</span></Button></div></div></header><main className="page-shell py-8 sm:py-10">{locked ? <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} featureId="kitchen" /> : <><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Operação em tempo real</p><h1 className="mt-2 font-display text-4xl font-bold">Pedidos do restaurante</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Confirme, coloque em produção e envie os pedidos para entrega em poucos passos.</p></div><div className="flex flex-wrap items-center gap-2"><NewCounterOrder /><Button variant="outline" onClick={() => void orders.refetch()} disabled={orders.isFetching} className="h-10 rounded-xl border-[#d8c8b4] bg-[#fffdf8]"><RefreshCw className={`mr-2 h-4 w-4 ${orders.isFetching ? "animate-spin" : ""}`} />Atualizar</Button></div></div><CollapsibleSection title={<h2 className="font-display text-2xl font-bold">Pedidos do restaurante</h2>} badge={<span className="grid h-9 min-w-9 place-items-center rounded-xl bg-[#f3e2d8] text-sm font-bold text-primary">{operationalOrders.length}</span>}>
  {orders.error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p className="font-semibold">Não foi possível carregar os pedidos.</p><p className="mt-1">{orders.error.message}</p></div> : operationalOrders.length ? <div className="grid gap-5 xl:grid-cols-3">{(Object.keys(statusMeta) as ActiveStatus[]).map(status => { const meta = statusMeta[status]; const Icon = meta.icon; const columnOrders = operationalOrders.filter(order => order.status === status); return <section key={status} className={`rounded-3xl border p-4 sm:p-5 ${meta.tone}`}><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-display text-2xl font-bold">{meta.title}</h3><p className="mt-1 text-xs leading-5 text-[#695b50]">{meta.description}</p></div><span className="grid h-9 min-w-9 place-items-center rounded-xl bg-white/80 text-sm font-bold text-[#6b4834]"><Icon className="h-4 w-4" /></span></div><div className="space-y-3">{columnOrders.length ? columnOrders.map(order => <OrderCard key={order.id} order={order} />) : <div className="rounded-2xl border border-dashed border-[#d4c4b1] bg-white/65 p-6 text-center text-sm text-[#776558]">Nenhum pedido nesta etapa.</div>}</div></section>; })}</div> : <div className="rounded-3xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-12 text-center"><ShoppingBag className="mx-auto h-9 w-9 text-[#b89e7a]" /><h2 className="mt-4 font-display text-2xl font-bold">Nenhum pedido em andamento.</h2><p className="mt-2 text-sm text-muted-foreground">Os novos pedidos aparecerão aqui automaticamente.</p></div>}
</CollapsibleSection><section className="mt-10"><h2 className="font-display text-3xl font-bold">Mesas</h2><p className="mt-1 text-sm text-muted-foreground">Toque numa mesa ocupada para ver a comanda, lançar rodadas e fechar a conta.</p><div className="mt-4"><TableMapManager /></div></section></>}</main></div>;
}
