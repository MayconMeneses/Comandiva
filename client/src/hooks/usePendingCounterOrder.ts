import { useSyncExternalStore } from "react";
import { PENDING_ORDER_CHANGE_EVENT, loadPendingOrderDisplay, type PendingDisplaySnapshot } from "@/lib/pendingOrderQueue";

const CONTEXT = { type: "order.create" as const, screen: "counter" as const };

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PENDING_ORDER_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(PENDING_ORDER_CHANGE_EVENT, onChange);
}

// useSyncExternalStore exige referência ESTÁVEL de getSnapshot quando o dado
// não mudou de verdade — loadPendingOrderDisplay faz JSON.parse a cada
// chamada (sempre um objeto novo), o que faz o React entender que o
// snapshot mudou em TODO render e entrar num loop de atualização infinito
// (confirmado testando: "Maximum update depth exceeded"). Cache simples por
// conteúdo serializado resolve sem precisar mudar loadPendingOrderDisplay
// (usado também fora de componentes React, onde isso não importaria).
let cachedSerialized: string | null = null;
let cachedSnapshot: PendingDisplaySnapshot | null = null;

function getSnapshot(): PendingDisplaySnapshot | null {
  const next = loadPendingOrderDisplay(CONTEXT);
  const serialized = next ? JSON.stringify(next) : null;
  if (serialized !== cachedSerialized) {
    cachedSerialized = serialized;
    cachedSnapshot = next;
  }
  return cachedSnapshot;
}

// Fase 2 do offline-first (ver C:\Users\maico\.claude\plans\lovely-purring-dusk.md):
// ponte entre quem grava a pendência (NewCounterOrder.tsx, fora da árvore
// desta tela) e quem exibe o cartão otimista (RestaurantOrders.tsx) —
// localStorage não notifica a própria aba que escreveu, por isso o evento
// customizado disparado em pendingOrderQueue.ts.
export function usePendingCounterOrder(): PendingDisplaySnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
