import { Button } from "@/components/ui/button";
import { isRetryingOffline, offlineResilienceMutationOptions } from "@/lib/offlineRetry";
import { clearPendingOrder, readValidPendingOrders, type PendingQueueEntry } from "@/lib/pendingOrderQueue";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function contextOf(entry: PendingQueueEntry) {
  if (entry.type === "order.create") return { type: "order.create" as const, screen: entry.screen };
  if (entry.type === "table.addRound") return { type: "table.addRound" as const, token: entry.token };
  if (entry.type === "admin.addManualRound") return { type: "admin.addManualRound" as const, tableId: entry.tableId };
  if (entry.type === "admin.updateOrderStatus") return { type: "admin.updateOrderStatus" as const, orderId: entry.orderId };
  return { type: "admin.recordBillPayment" as const, tableSessionId: entry.tableSessionId };
}

// itemCount só faz sentido pras 3 entradas de pedido/rodada (tem itens de
// verdade) — atualização de status e pagamento são ações únicas, mensagem
// própria em vez de forçar "X itens" onde não se aplica.
function messageFor(entry: PendingQueueEntry) {
  if (entry.type === "admin.updateOrderStatus") return "Você tem uma atualização de status de pedido pendente de confirmação.";
  if (entry.type === "admin.recordBillPayment") return "Você tem um pagamento pendente de confirmação.";
  return `Você tem um pedido pendente de confirmação (${entry.itemCount} ${entry.itemCount === 1 ? "item" : "itens"}).`;
}

/**
 * Recuperação de um pedido/rodada que ficou pendente numa sessão de navegador
 * ANTERIOR (aba fechou/recarregou com a mutation ainda pausada/em voo — a
 * Fase 3 estrita já cobre o caso "mesma aba, mesma sessão JS" inline em cada
 * tela). Lê a fila só uma vez no mount, de propósito: este componente nunca
 * desmonta entre navegações (montado em App.tsx), então já checou e achou
 * vazio antes de qualquer pendência nascer NA MESMA sessão.
 */
export default function PendingOrderBanner() {
  const [entry, setEntry] = useState<PendingQueueEntry | null>(null);
  const utils = trpc.useUtils();
  // offline_resilience é recurso de plano — se o restaurante foi rebaixado
  // depois de uma pendência ter sido salva num plano anterior, o banner não
  // deve aparecer (ver client/src/lib/offlineRetry.ts).
  const settings = trpc.catalog.settings.useQuery();
  const offlineResilienceEnabled = Boolean(settings.data?.offlineResilienceEnabled);

  useEffect(() => {
    if (!offlineResilienceEnabled) return;
    setEntry(readValidPendingOrders()[0] ?? null);
  }, [offlineResilienceEnabled]);

  const discard = () => {
    if (!entry) return;
    clearPendingOrder(contextOf(entry));
    setEntry(null);
  };

  const createOrder = trpc.order.create.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onSuccess: result => {
      toast.success(`Pedido ${result.publicCode} confirmado.`);
      void utils.admin.orders.invalidate();
      void utils.admin.operationalSnapshot.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  const addRound = trpc.table.addRound.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onSuccess: () => {
      toast.success("Pedido enviado para a cozinha!");
      if (entry?.type === "table.addRound") void utils.table.resolve.invalidate({ token: entry.token });
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  const addManualRound = trpc.admin.addManualRound.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onSuccess: () => {
      toast.success("Rodada lançada na comanda.");
      void utils.admin.operationalSnapshot.invalidate();
      if (entry?.type === "admin.addManualRound") void utils.admin.sessionDetail.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  const updateOrderStatus = trpc.admin.updateOrderStatus.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onSuccess: () => {
      toast.success("Status do pedido atualizado.");
      void utils.admin.operationalSnapshot.invalidate();
      void utils.admin.orders.invalidate();
      void utils.admin.dashboard.invalidate();
    },
    // CONFLICT aqui é esperado num caso: esta MESMA tentativa já tinha dado
    // certo antes da resposta se perder na queda — não é um erro de verdade,
    // só sincroniza a tela com o status real (texto neutro, ver
    // server/routers/admin/orders.ts).
    onError: error => toast.error(error.data?.code === "CONFLICT" ? "Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente." : error.message),
    onSettled: discard,
  });

  const recordBillPayment = trpc.admin.recordBillPayment.useMutation({
    ...offlineResilienceMutationOptions(offlineResilienceEnabled),
    onSuccess: () => {
      toast.success("Pagamento registrado.");
      void utils.admin.operationalSnapshot.invalidate();
      if (entry?.type === "admin.recordBillPayment") void utils.admin.sessionDetail.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  if (!entry) return null;
  const mutation = entry.type === "order.create" ? createOrder
    : entry.type === "table.addRound" ? addRound
    : entry.type === "admin.addManualRound" ? addManualRound
    : entry.type === "admin.updateOrderStatus" ? updateOrderStatus
    : recordBillPayment;
  const retrying = isRetryingOffline(mutation);

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500 bg-amber-950 px-4 py-2.5 text-amber-50">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>{messageFor(entry)}</span>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={mutation.isPending}
          // O payload já traz o MESMO operationId da tentativa original —
          // nenhum código aqui gera um id novo, preservando o dedupe do
          // servidor mesmo se o pedido original já tiver sido aceito.
          onClick={() => mutation.mutate(entry.payload as never)}
          className="h-8 bg-amber-100 text-xs text-amber-950 hover:bg-amber-200"
        >
          {retrying ? "Tentando…" : "Tentar enviar agora"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={discard}
          className="h-8 border-amber-400 bg-transparent text-xs text-amber-50 hover:bg-amber-900"
        >
          Descartar
        </Button>
      </div>
    </div>
  );
}
