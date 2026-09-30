import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDeviceId } from "@/lib/deviceId";
import { isRetryingOffline, offlineResilienceMutationOptions } from "@/lib/offlineRetry";
import { clearPendingOrder, PENDING_ORDER_SCHEMA_VERSION, persistPendingOrder } from "@/lib/pendingOrderQueue";
import { trpc } from "@/lib/trpc";
import { ChevronRight, ClipboardList, Printer } from "lucide-react";
import { toast } from "sonner";
import { Loading, money, nextAction, tone, labels } from "./shared";

const ORIGIN_TAG: Record<string, string> = { GARCOM: "Garçom", QR_CODE: "QR Code", BALCAO: "Balcão" };

export function OrderActions({ order }: { order: { id: number; status: string; fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN" } }) {
  const utils = trpc.useUtils();
  // onError também invalida (não só onSuccess) e mostra toast num CONFLICT —
  // mesma proteção de RestaurantOrders.tsx::OrderCard/Kitchen.tsx::QueueCard:
  // esta tabela (Visão Geral) pode estar aberta num dispositivo enquanto
  // outro membro da equipe mexe no mesmo pedido por /painel-pedidos ou
  // /cozinha.
  // Dedupe com a mesma consulta já feita em RestaurantOrders.tsx/Kitchen.tsx
  // — React Query compartilha o cache, sem requisição extra.
  const settings = trpc.catalog.settings.useQuery();
  const offlineResilienceEnabled = Boolean(settings.data?.offlineResilienceEnabled);
  const update = trpc.admin.updateOrderStatus.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onMutate: variables => {
      if (!offlineResilienceEnabled) return;
      persistPendingOrder({ type: "admin.updateOrderStatus", orderId: order.id, payload: variables, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
    },
    onSettled: () => { if (offlineResilienceEnabled) clearPendingOrder({ type: "admin.updateOrderStatus", orderId: order.id }); },
    onSuccess: () => { void utils.admin.orders.invalidate(); void utils.admin.dashboard.invalidate(); },
    onError: error => {
      void utils.admin.orders.invalidate(); void utils.admin.dashboard.invalidate();
      if (error.data?.code === "CONFLICT") toast.error("Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente.");
    },
  });
  const action = order.status === "PREPARING"
    ? order.fulfillmentType === "DELIVERY" ? { status: "OUT_FOR_DELIVERY" as const, label: "Saiu para entrega" }
    : order.fulfillmentType === "DINE_IN" ? { status: "READY_FOR_PICKUP" as const, label: "Pronto para servir" }
    : { status: "READY_FOR_PICKUP" as const, label: "Pronto para retirada" }
    : order.status === "READY_FOR_PICKUP" && order.fulfillmentType === "DINE_IN" ? { status: "COMPLETED" as const, label: "Marcar como servido" }
    : nextAction[order.status];
  const canCancel = ["PENDING", "ACCEPTED", "PREPARING"].includes(order.status);
  return <div className="flex items-center justify-end gap-2"><button type="button" onClick={() => window.open(`/admin/comprovante/${order.id}`, "_blank", "noopener,noreferrer")} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:border-primary hover:text-primary" aria-label="Abrir comprovante para impressão"><Printer className="h-3.5 w-3.5" /></button>{canCancel && <button type="button" disabled={update.isPending} onClick={() => update.mutate({ orderId: order.id, status: "CANCELLED", note: "Cancelado pelo restaurante", expectedStatus: order.status as "PENDING" | "ACCEPTED" | "PREPARING", deviceId: getDeviceId() })} className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">Cancelar</button>}{action ? <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ orderId: order.id, status: action.status, expectedStatus: order.status as "PENDING" | "ACCEPTED" | "PREPARING" | "OUT_FOR_DELIVERY" | "READY_FOR_PICKUP", deviceId: getDeviceId() })} className="h-8 rounded-lg bg-primary text-xs hover:bg-primary-hover">{isRetryingOffline(update) ? "Tentando de novo…" : update.isPending ? "Atualizando…" : action.label}<ChevronRight className="ml-1 h-3.5 w-3.5" /></Button> : <span className="text-xs text-muted-foreground">Sem novas ações</span>}</div>;
}

export default function OrdersTable({ compact = false }: { compact?: boolean }) {
  const orders = trpc.admin.orders.useQuery({ limit: compact ? 10 : 60 });
  if (orders.isLoading) return <Loading />; if (orders.error) return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{orders.error.message}</p>;
  if (!orders.data?.length) return <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-display text-xl font-bold">Nenhum pedido por enquanto.</p><p className="mt-1 text-sm text-muted-foreground">Os próximos pedidos aparecerão aqui automaticamente.</p></div>;
  return <div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-muted text-xs font-bold uppercase tracking-[.12em] text-muted-foreground"><tr><th className="px-5 py-4">Pedido</th><th className="px-5 py-4">Cliente</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Total</th><th className="px-5 py-4 text-right">Ação</th></tr></thead><tbody>{orders.data.map(order => <tr key={order.id} className="border-t border-border text-sm"><td className="px-5 py-4"><p className="font-bold">{order.publicCode}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p></td><td className="px-5 py-4"><p className="font-medium">{order.customerName}</p><p className="mt-1 text-xs text-muted-foreground">{order.customerPhone}</p></td><td className="px-5 py-4">{order.fulfillmentType === "DELIVERY" ? "Entrega" : order.fulfillmentType === "DINE_IN" ? "Mesa" : "Retirada"}{ORIGIN_TAG[order.origin] ? <span className="ml-1 text-xs text-muted-foreground">· {ORIGIN_TAG[order.origin]}</span> : null}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><Badge className={`border-0 ${tone[order.status]}`}>{labels[order.status]}</Badge>{order.paymentMethod === "CARD_ONLINE" ? <Badge className={`border-0 ${order.payment?.status === "REFUNDED" ? "bg-red-100 text-red-800" : order.payment?.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{order.payment?.status === "REFUNDED" ? "Reembolsado" : order.payment?.status === "PAID" ? "Pago" : "Aguard. pagamento"}</Badge> : null}</div></td><td className="px-5 py-4 font-semibold">{money(order.totalCents)}</td><td className="px-5 py-4 text-right"><OrderActions order={order} /></td></tr>)}</tbody></table></div></div>;
}
