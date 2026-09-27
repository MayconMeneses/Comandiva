import { useEffect, useRef, type MutableRefObject } from "react";
import { generateClientId } from "@/lib/randomId";
import { resumeOrCreateOperationId } from "@/lib/pendingOrderQueue";

type PendingOrderContext = Parameters<typeof resumeOrCreateOperationId>[0];

/**
 * Achado de revisão de código: as 3 telas que enviam pedido/rodada usavam
 * `useRef(offlineResilienceEnabled ? resumeOrCreateOperationId(...) : generateClientId())`
 * — o inicializador do useRef só roda na 1ª renderização, e
 * `offlineResilienceEnabled` depende de uma query assíncrona
 * (catalog.settings) que nunca respondeu ainda nesse momento (recarregar a
 * página é sempre uma 1ª renderização de novo). Na prática, o ramo
 * `resumeOrCreateOperationId` nunca rodava num F5/reabrir aba — exatamente o
 * caso que ele existe pra cobrir (retomar o id de um pedido pendente salvo
 * antes da aba cair). Um resubmit pela tela normal (não pelo banner) então
 * usava um operationId novo, derrotando o dedupe do servidor e arriscando
 * duplicar um pedido já aceito.
 *
 * Corrigido: começa com um id descartável (mesmo comportamento de sempre
 * pro caso raro de a pessoa conseguir enviar antes da 1ª resposta da query)
 * e, assim que `offlineResilienceEnabled` é conhecido de verdade (deixa de
 * ser `undefined`), troca pelo id retomado — uma única vez, antes de
 * qualquer submit realista (a query resolve muito antes de alguém terminar
 * de preencher o formulário).
 */
export function useResumableOperationId(context: PendingOrderContext, offlineResilienceEnabled: boolean | undefined): MutableRefObject<string> {
  const operationIdRef = useRef(generateClientId());
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (offlineResilienceEnabled === undefined || resolvedRef.current) return;
    resolvedRef.current = true;
    if (offlineResilienceEnabled) operationIdRef.current = resumeOrCreateOperationId(context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineResilienceEnabled]);

  return operationIdRef;
}
