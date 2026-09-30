import { Button } from "@/components/ui/button";

/**
 * Mostrado sempre que uma mutation de criar pedido/rodada está presa
 * retryando offline (`isRetryingOffline`, client/src/lib/offlineRetry.ts).
 *
 * Mutations do React Query 5.90.2 não suportam cancelamento de verdade (sem
 * abort/signal — confirmado lendo query-core/src/mutation.ts: `reset()` só
 * desanexa o observer da UI, a `Mutation`/`Retryer` internos continuam
 * existindo no cache esperando a internet voltar, e VÃO disparar sozinhos
 * quando isso acontecer, mesmo já resetados na tela). Por isso não existe
 * botão de "cancelar" aqui — um botão desses mentiria: pareceria que matou a
 * tentativa, mas o pedido podia aparecer de verdade minutos/horas depois,
 * sem ninguém saber pra conferir.
 *
 * Recarregar a página É seguro: mata a mutation pausada na hora (nada tinha
 * sido enviado de verdade enquanto pausada — só reload de aba garante isso,
 * nenhuma API do React Query garante). O pedido não se perde: já está salvo
 * em localStorage (persistPendingOrder) e o PendingOrderBanner recupera ele
 * assim que a internet voltar, com a opção de reenviar ou descartar.
 */
export function OfflineRetryNotice({ stale, className = "text-amber-700" }: { stale: boolean; className?: string }) {
  return (
    <div className={`text-xs leading-5 sm:text-sm ${className}`}>
      <p>{stale ? "Conexão perdida há muito tempo — os preços podem ter mudado." : "Sem conexão. Tentando enviar de novo sozinho assim que a internet voltar."}</p>
      <p className="mt-0.5">Esse pedido já está salvo. Para fazer outro agora, recarregue a página — nada se perde.</p>
      <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()} className="mt-1.5 h-7 rounded-lg border-current px-2.5 text-xs">
        Recarregar página
      </Button>
    </div>
  );
}
