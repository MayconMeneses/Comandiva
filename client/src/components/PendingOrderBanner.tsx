import { Button } from "@/components/ui/button";
import { isRetryingOffline, orderMutationRetryDelay, shouldRetryOrderMutation } from "@/lib/offlineRetry";
import { clearPendingOrder, readValidPendingOrders, type PendingQueueEntry } from "@/lib/pendingOrderQueue";
import { trpc } from "@/lib/trpc";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function contextOf(entry: PendingQueueEntry) {
  return entry.type === "order.create" ? { type: "order.create" as const, screen: entry.screen } : { type: "table.addRound" as const, token: entry.token };
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

  useEffect(() => {
    setEntry(readValidPendingOrders()[0] ?? null);
  }, []);

  const discard = () => {
    if (!entry) return;
    clearPendingOrder(contextOf(entry));
    setEntry(null);
  };

  const createOrder = trpc.order.create.useMutation({
    retry: shouldRetryOrderMutation,
    retryDelay: orderMutationRetryDelay,
    onSuccess: result => {
      toast.success(`Pedido ${result.publicCode} confirmado.`);
      void utils.admin.orders.invalidate();
      void utils.admin.operationalSnapshot.invalidate();
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  const addRound = trpc.table.addRound.useMutation({
    retry: shouldRetryOrderMutation,
    retryDelay: orderMutationRetryDelay,
    onSuccess: () => {
      toast.success("Pedido enviado para a cozinha!");
      if (entry?.type === "table.addRound") void utils.table.resolve.invalidate({ token: entry.token });
    },
    onError: error => toast.error(error.message),
    onSettled: discard,
  });

  if (!entry) return null;
  const mutation = entry.type === "order.create" ? createOrder : addRound;
  const retrying = isRetryingOffline(mutation);

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500 bg-amber-950 px-4 py-2.5 text-amber-50">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Você tem um pedido pendente de confirmação ({entry.itemCount} {entry.itemCount === 1 ? "item" : "itens"}).
        </span>
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
