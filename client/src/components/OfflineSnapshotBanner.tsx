import { WifiOff } from "lucide-react";

/**
 * Aviso de "modo offline" pra Kitchen/RestaurantOrders/TableMapManager (Fase
 * A do offline-first do painel, ver plano em
 * C:\Users\maico\.claude\plans\curried-sprouting-wirth.md) — mesmo padrão
 * visual/estrutural de PendingOrderBanner.tsx, mas sem ação nenhuma: aqui é
 * só leitura de um snapshot salvo, não tem "tentar enviar de novo".
 */
export function OfflineSnapshotBanner({ cachedAt }: { cachedAt: number | undefined }) {
  const time = cachedAt ? new Date(cachedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 border-b-2 border-amber-500 bg-amber-950 px-4 py-2.5 text-sm font-semibold text-amber-50">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{time ? `Sem conexão — mostrando dados de ${time}. Atualiza sozinho quando a internet voltar.` : "Sem conexão — sem dados recentes salvos neste aparelho."}</span>
    </div>
  );
}
