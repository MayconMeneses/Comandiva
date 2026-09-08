import { useEffect, useState } from "react";

function useTicker(intervalMs: number) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(current => current + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

/** Verde até orangeAtMinutes, depois vai ficando laranja e, ao chegar em redAtMinutes, vermelha. */
function colorFor(elapsedMinutes: number, orangeAtMinutes: number, redAtMinutes: number) {
  if (elapsedMinutes < orangeAtMinutes) return "rgb(5,150,105)"; // emerald-600
  const t = Math.min(1, (elapsedMinutes - orangeAtMinutes) / (redAtMinutes - orangeAtMinutes));
  const orange = [245, 158, 11]; // amber-500
  const red = [220, 38, 38]; // red-600
  const [r, g, b] = [lerp(orange[0], red[0], t), lerp(orange[1], red[1], t), lerp(orange[2], red[2], t)];
  return `rgb(${r},${g},${b})`;
}

/**
 * Barra de tempo decorrido com faixas verde/laranja/vermelho configuráveis —
 * usada tanto para o tempo esperando aceite (padrão 20/40min, sem urgência
 * extra) quanto para o tempo de produção depois de aceito (5/10min — é aí
 * que o atraso realmente aparece pro cliente), cada etapa com seu próprio
 * limite, em vez de uma barra única para o pedido inteiro.
 */
export function PrepTimeProgress({ since, size = "md", label = "Preparo", orangeAtMinutes = 20, redAtMinutes = 40 }: { since: number; size?: "sm" | "md"; label?: string; orangeAtMinutes?: number; redAtMinutes?: number }) {
  useTicker(15000);
  const elapsedMinutes = (Date.now() - since) / 60000;
  const percent = Math.min(100, Math.round((elapsedMinutes / redAtMinutes) * 100));
  const overdue = elapsedMinutes >= redAtMinutes;
  const color = colorFor(elapsedMinutes, orangeAtMinutes, redAtMinutes);
  const displayLabel = overdue ? `Atrasado · ${Math.round(elapsedMinutes)} min` : `${Math.round(elapsedMinutes)} min · ${percent}%`;
  return (
    <div className={size === "sm" ? "w-32" : "w-full"}>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#8a7a6b]">
        <span>{label}</span>
        <span style={overdue ? { color } : undefined}>{displayLabel}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#eee4d8]">
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
