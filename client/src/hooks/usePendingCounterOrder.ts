import { useRef, useSyncExternalStore } from "react";
import { PENDING_ORDER_CHANGE_EVENT, loadPendingOrderDisplay, type PendingContext, type PendingDisplaySnapshot } from "@/lib/pendingOrderQueue";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PENDING_ORDER_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(PENDING_ORDER_CHANGE_EVENT, onChange);
}

// Fase 2b (Frente 1, ver C:\Users\maico\.claude\plans\lovely-purring-dusk.md):
// generalizado a partir do usePendingCounterOrder original pra servir
// qualquer contexto (balcão, mesa via QR, rodada lançada pelo admin), não só
// o pedido de balcão. Ponte de reatividade entre quem grava a pendência
// (fora da árvore de quem exibe) e quem exibe o cartão otimista —
// localStorage não notifica a própria aba que escreveu, por isso o evento
// customizado disparado em pendingOrderQueue.ts.
//
// useSyncExternalStore exige referência ESTÁVEL de getSnapshot quando o dado
// não mudou de verdade — loadPendingOrderDisplay faz JSON.parse a cada
// chamada (sempre um objeto novo), o que faz o React entender que o
// snapshot mudou em TODO render e entrar num loop de atualização infinito
// (confirmado testando: "Maximum update depth exceeded"). Cache simples por
// conteúdo serializado resolve sem precisar mudar loadPendingOrderDisplay
// (usado também fora de componentes React, onde isso não importaria). O
// cache precisa ser POR INSTÂNCIA do hook (useRef), não módulo-global como
// na versão original — agora várias instâncias (contextos diferentes, ex.:
// balcão e mesa ao mesmo tempo) leem em paralelo, e um cache compartilhado
// contaminaria o resultado de uma pela outra.
export function usePendingDisplaySnapshot<T>(context: PendingContext): T | null {
  const cacheRef = useRef<{ serialized: string | null; snapshot: T | null }>({ serialized: null, snapshot: null });

  function getSnapshot(): T | null {
    const next = loadPendingOrderDisplay<T>(context);
    const serialized = next ? JSON.stringify(next) : null;
    if (serialized !== cacheRef.current.serialized) {
      cacheRef.current = { serialized, snapshot: next };
    }
    return cacheRef.current.snapshot;
  }

  return useSyncExternalStore(subscribe, getSnapshot);
}

const COUNTER_ORDER_CONTEXT: PendingContext = { type: "order.create", screen: "counter" };

// Wrapper fino em cima do genérico — zero mudança de import site pra quem já
// usava isto (RestaurantOrders.tsx) nem nos testes existentes.
export function usePendingCounterOrder(): PendingDisplaySnapshot | null {
  return usePendingDisplaySnapshot<PendingDisplaySnapshot>(COUNTER_ORDER_CONTEXT);
}
