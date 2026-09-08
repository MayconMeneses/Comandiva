import { PanelLayout } from "@/components/PanelLayout";
import { StatTile } from "@/components/ui/StatTile";
import { trpc } from "@/lib/trpc";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const shortDate = (ms: number) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(ms));

export default function Dashboard() {
  const summary = trpc.masterPanel.dashboard.summary.useQuery();

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Dashboard</h1>
      {summary.isLoading ? (
        <p className="mt-4 text-sm text-ink-soft">Carregando…</p>
      ) : summary.error || !summary.data ? (
        <p className="mt-4 text-sm text-red-700">Não foi possível carregar o resumo.</p>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="MRR" value={money(summary.data.mrrCents)} />
            <StatTile label="Novos clientes (mês)" value={String(summary.data.newCustomersThisMonth)} />
            <StatTile label="Upgrades (mês)" value={String(summary.data.planChangesThisMonth.upgrades)} />
            <StatTile label="Downgrades (mês)" value={String(summary.data.planChangesThisMonth.downgrades)} />
          </div>

          <div className="rounded-xl border border-border bg-paper-raised p-4">
            <h2 className="text-sm font-semibold text-ink">Novos cadastros (8 semanas)</h2>
            {(() => {
              const trend = summary.data.signupsTrend;
              const maxCount = Math.max(1, ...trend.map(week => week.count));
              return (
                <div className="mt-3 flex items-end gap-2">
                  {trend.map(week => (
                    <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-xs font-medium tabular-nums text-ink">{week.count}</span>
                      <div className="flex h-24 w-full items-end">
                        <div
                          className="w-full rounded-t bg-accent"
                          style={{ height: `${Math.max(4, (week.count / maxCount) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-ink-soft">{shortDate(week.weekStart)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Restaurantes por status</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.data.restaurantsByStatus.map(row => (
                <StatTile key={row.status} label={row.status} value={String(row.total)} />
              ))}
              {!summary.data.restaurantsByStatus.length ? <p className="text-sm text-ink-soft">Nenhum restaurante cadastrado ainda.</p> : null}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">Assinaturas ativas por plano</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.data.activeSubscriptionsByPlan.map(row => (
                <StatTile key={row.planKey} label={row.planName} value={String(row.total)} hint={money(row.priceCents)} />
              ))}
              {!summary.data.activeSubscriptionsByPlan.length ? <p className="text-sm text-ink-soft">Nenhuma assinatura ativa ainda.</p> : null}
            </div>
          </div>

          {!summary.data.hasAnyPayments ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-ink-soft">
              Nenhum pagamento registrado ainda — a cobrança automática via Mercado Pago já está integrada; isto aparece assim que o primeiro ciclo real for cobrado.
            </p>
          ) : null}
        </div>
      )}
    </PanelLayout>
  );
}
