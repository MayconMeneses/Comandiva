import { WifiOff } from "lucide-react";
import type { PendingRoundDisplaySnapshot } from "@/lib/pendingOrderQueue";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

// Cartão otimista pra rodada de mesa (QR Code público ou lançada pela
// equipe) pausada numa pane longa — mesmo molde do PendingCounterOrderCard
// de RestaurantOrders.tsx (Fase 2), generalizado pra Frente 1 da Fase 2b
// (ver C:\Users\maico\.claude\plans\lovely-purring-dusk.md). Visualmente
// distinto de propósito (borda tracejada, sem ação de avançar status): ainda
// não é uma rodada de verdade, só confirma que o lançamento não se perdeu.
// Some sozinho quando a mutation resolve (onSettled limpa a pendência, que
// dispara o evento de reatividade que usePendingDisplaySnapshot escuta).
export function PendingRoundCard({ pending }: { pending: PendingRoundDisplaySnapshot }) {
  return <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/70 p-4">
    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800"><WifiOff className="h-3.5 w-3.5" />Aguardando conexão</div>
    <p className="mt-2 text-xs leading-5 text-[#695b50]">{pending.items.map(item => `${item.quantity}× ${item.name}`).join(" · ")}</p>
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-amber-200 pt-3"><strong className="text-sm text-[#241b16]">{money(pending.totalCents)}</strong><span className="text-xs font-medium text-amber-700">Será enviado quando a conexão voltar</span></div>
  </div>;
}
