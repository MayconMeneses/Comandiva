import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { LockedFeatureCard } from "./LockedFeature";
import { Loading, money } from "./shared";

type Period = { range: "today" | "7days" | "30days" | "custom"; customDate?: string };

/** Relatório avançado (Premium) — "por que estou vendendo assim e onde posso melhorar": clientes novos x recorrentes, frequência de compra, dia de maior movimento, produtos em alta/queda, cancelamento, desconto aplicado. */
export default function ReportsAdvancedSection({ range, customDate }: Period) {
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const locked = snapshot.data?.lockedFeatures.reports_advanced;
  const report = trpc.admin.reportsAdvanced.useQuery({ range, customDate }, { enabled: !snapshot.isLoading && !locked });
  const utils = trpc.useUtils();

  if (snapshot.isLoading) return <Loading />;
  if (locked) return <LockedFeatureCard title="Relatório avançado" requiredPlanName={locked.requiredPlanName} featureId="reports_advanced" />;
  if (report.isLoading || !report.data) return <Loading />;
  const data = report.data;

  async function exportCsv() {
    const result = await utils.admin.exportReportsAdvanced.fetch({ range, customDate });
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-avancado-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const bestWeekday = data.byWeekday.reduce((best, row) => (row.revenueCents > best.revenueCents ? row : best), data.byWeekday[0]!);

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Relatório avançado</h2>
          <p className="text-sm text-muted-foreground">Por que estou vendendo assim e onde posso melhorar.</p>
        </div>
        <Button variant="outline" onClick={() => void exportCsv()} className="h-9 rounded-xl border-border bg-card text-xs"><Download className="mr-1.5 h-3.5 w-3.5" />Exportar CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clientes novos x recorrentes</p>
          <p className="mt-2 text-sm">Novos: <strong>{data.newVsReturning.newCustomers}</strong> ({money(data.newVsReturning.newRevenueCents)})</p>
          <p className="mt-1 text-sm">Recorrentes: <strong>{data.newVsReturning.returningCustomers}</strong> ({money(data.newVsReturning.returningRevenueCents)})</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequência de compra</p>
          <p className="mt-2 text-xl font-bold">{data.purchaseFrequency.averageOrdersPerCustomer.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">pedidos/cliente</span></p>
          <p className="mt-1 text-xs text-muted-foreground">{data.purchaseFrequency.distinctCustomers} clientes distintos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dia de maior movimento</p>
          <p className="mt-2 text-xl font-bold">{bestWeekday.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{money(bestWeekday.revenueCents)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Faturamento por dia da semana</h3>
        <div className="mt-3 space-y-2">
          {data.byWeekday.map(row => (
            <div key={row.weekday} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold">{money(row.revenueCents)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-lg font-bold">Produtos em alta e em queda</h3>
        <p className="text-xs text-muted-foreground">Comparado ao período anterior de mesma duração.</p>
        {data.productTrend.length ? (
          <div className="mt-3 space-y-2">
            {data.productTrend.slice(0, 10).map(row => (
              <div key={row.productId} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{row.name}</span>
                <span className={`flex items-center gap-1 text-xs font-semibold ${row.changePct == null ? "text-muted-foreground" : row.changePct >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {row.changePct == null ? "novo no período" : <>{row.changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{Math.abs(row.changePct).toFixed(0)}%</>}
                </span>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-sm text-muted-foreground">Sem dados suficientes no período.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold">Cancelamentos</h3>
          <p className="mt-2 text-xl font-bold">{data.cancellation.cancelledRatePct.toFixed(1)}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.cancellation.cancelledCount} de {data.cancellation.totalOrdersIncludingCancelled} pedidos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-bold">Descontos aplicados</h3>
          <p className="mt-2 text-xl font-bold">{money(data.discounts.totalDiscountCents)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{data.discounts.ordersWithDiscountCount} pedido(s) com desconto</p>
        </div>
      </div>
    </div>
  );
}
