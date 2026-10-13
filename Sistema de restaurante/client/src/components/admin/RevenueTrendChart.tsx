import { trpc } from "@/lib/trpc";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { money } from "./shared";

type Granularity = "week" | "month" | "year";
const GRANULARITY_LABEL: Record<Granularity, string> = { week: "Semana", month: "Mês", year: "Ano" };
const PREVIOUS_LABEL: Record<Granularity, string> = { week: "a semana anterior", month: "o mês anterior", year: "o ano anterior" };
const PEAK_LABEL: Record<Granularity, string> = { week: "Melhor dia", month: "Melhor dia", year: "Melhor mês" };

const CHART_WIDTH = 760;
const CHART_HEIGHT = 200;
const BASELINE_Y = CHART_HEIGHT - 24;

/** Gráfico de movimento em Relatórios — barras simples em SVG inline (sem lib de gráfico, mesmo raciocínio já usado no resto do projeto). */
export default function RevenueTrendChart() {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const trend = trpc.admin.revenueTrend.useQuery({ granularity });
  const data = trend.data;
  const maxRevenue = data ? Math.max(1, ...data.series.map(bucket => bucket.revenueCents)) : 1;
  const peak = data?.series.reduce((best, bucket) => (bucket.revenueCents > best.revenueCents ? bucket : best), data.series[0]);
  const barGap = 4;
  const barWidth = data ? CHART_WIDTH / data.series.length - barGap : 0;
  const labelEvery = data && data.series.length > 14 ? 5 : 1;

  return <div className="rounded-2xl border border-border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-bold">Movimento</h2>
      <div className="flex gap-2">{(["week", "month", "year"] as const).map(value => <button key={value} type="button" onClick={() => setGranularity(value)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${granularity === value ? "bg-primary text-white" : "border border-border bg-card text-muted-foreground hover:border-[#bd8a7c]"}`}>{GRANULARITY_LABEL[value]}</button>)}</div>
    </div>

    {trend.isLoading && <div className="mt-6 h-48 animate-pulse rounded-xl bg-muted" />}
    {trend.error && <p className="mt-6 text-sm text-red-700">Não foi possível carregar o movimento agora. {trend.error.message}</p>}

    {data && <>
      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-2">
        <div><p className="text-xs text-muted-foreground">Faturamento no período</p><p className="mt-1 font-display text-3xl font-bold">{money(data.currentTotalCents)}</p></div>
        <div><p className="text-xs text-muted-foreground">Pedidos concluídos</p><p className="mt-1 font-display text-2xl font-bold">{data.currentOrderCount}</p></div>
        {peak && peak.revenueCents > 0 && <div><p className="text-xs text-muted-foreground">{PEAK_LABEL[granularity]}</p><p className="mt-1 text-lg font-bold text-primary">{peak.label} · {money(peak.revenueCents)}</p></div>}
        {data.changePct !== null && <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${data.changePct >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          {data.changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {data.changePct >= 0 ? "+" : ""}{data.changePct.toFixed(1)}% vs. {PREVIOUS_LABEL[granularity]}
        </div>}
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} width="100%" height={CHART_HEIGHT} role="img" aria-label={`Gráfico de faturamento por ${GRANULARITY_LABEL[granularity].toLowerCase()}`} className="min-w-[480px]">
          <line x1={0} y1={BASELINE_Y} x2={CHART_WIDTH} y2={BASELINE_Y} stroke="#e4d8c8" strokeWidth={1} />
          {data.series.map((bucket, index) => {
            const height = Math.max(2, (bucket.revenueCents / maxRevenue) * (BASELINE_Y - 12));
            const x = index * (barWidth + barGap);
            const isLast = index === data.series.length - 1;
            const isPeak = bucket.revenueCents > 0 && bucket === peak;
            return <g key={`${bucket.label}-${index}`}>
              <rect x={x} y={BASELINE_Y - height} width={Math.max(1, barWidth)} height={height} rx={2} className={isLast ? "fill-primary" : undefined} fill={isLast ? undefined : isPeak ? "#e9a94f" : "#d99a7f"}>
                <title>{`${bucket.label}: ${money(bucket.revenueCents)} · ${bucket.orderCount} pedido(s)`}</title>
              </rect>
              {index % labelEvery === 0 && <text x={x + barWidth / 2} y={CHART_HEIGHT - 6} fontSize={10} textAnchor="middle" fill="#8a7a68">{bucket.label}</text>}
            </g>;
          })}
        </svg>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Passe o mouse sobre uma barra pra ver o valor exato daquele período.</p>
    </>}
  </div>;
}
