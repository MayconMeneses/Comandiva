import { trpc } from "@/lib/trpc";
import { PackageSearch } from "lucide-react";
import { LockedFeatureCard } from "./LockedFeature";
import { Loading, money } from "./shared";

type Period = { range: "today" | "7days" | "30days" | "custom"; customDate?: string };

function StatBlock({ title, rows }: { title: string; rows: { label: string; revenueCents: number; orderCount: number }[] }) {
  return (
    <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#5b4639]">{row.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-semibold">{money(row.revenueCents)}</span>
                <span className="text-xs text-muted-foreground">({row.orderCount})</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sem dados no período.</p>
      )}
    </div>
  );
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">sem período anterior pra comparar</span>;
  const positive = pct >= 0;
  return <span className={`text-xs font-semibold ${positive ? "text-emerald-700" : "text-red-700"}`}>{positive ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs. período anterior</span>;
}

/** Relatório completo (Profissional+) — "quanto vendi e o que está vendendo": faturamento detalhado por dia/hora/forma de pagamento/atendimento, produtos e categorias mais vendidos. */
export default function ReportsCompleteSection({ range, customDate }: Period) {
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const locked = snapshot.data?.lockedFeatures.reports_complete;
  const report = trpc.admin.reportsComplete.useQuery({ range, customDate }, { enabled: !snapshot.isLoading && !locked });

  if (snapshot.isLoading) return <Loading />;
  if (locked) return <LockedFeatureCard title="Relatório completo" requiredPlanName={locked.requiredPlanName} featureId="reports_complete" />;
  if (report.isLoading || !report.data) return <Loading />;
  const data = report.data;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center gap-3">
        <PackageSearch className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-2xl font-bold">Relatório completo</h2>
          <p className="text-sm text-muted-foreground">Quanto vendi e o que está vendendo.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Faturamento</p>
          <p className="mt-2 text-xl font-bold">{money(data.comparison.currentRevenueCents)}</p>
          <div className="mt-1"><ChangeBadge pct={data.comparison.revenueChangePct} /></div>
        </div>
        <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pedidos</p>
          <p className="mt-2 text-xl font-bold">{data.comparison.currentOrderCount}</p>
          <div className="mt-1"><ChangeBadge pct={data.comparison.orderCountChangePct} /></div>
        </div>
        <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket médio</p>
          <p className="mt-2 text-xl font-bold">{money(data.comparison.currentAvgTicketCents)}</p>
          <div className="mt-1"><ChangeBadge pct={data.comparison.avgTicketChangePct} /></div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatBlock title="Faturamento por forma de pagamento" rows={data.byPaymentMethod.map(row => ({ label: row.label, revenueCents: row.revenueCents, orderCount: row.orderCount }))} />
        <StatBlock title="Faturamento por tipo de atendimento" rows={data.byFulfillmentType.map(row => ({ label: row.label, revenueCents: row.revenueCents, orderCount: row.orderCount }))} />
        <StatBlock title="Produtos mais vendidos" rows={data.topProducts.map(row => ({ label: row.name, revenueCents: row.revenueCents, orderCount: row.quantity }))} />
        <StatBlock title="Categorias mais vendidas" rows={data.topCategories.map(row => ({ label: row.name, revenueCents: row.revenueCents, orderCount: row.quantity }))} />
      </div>

      <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-5">
        <h3 className="font-display text-lg font-bold">Faturamento por dia</h3>
        {data.byDay.length ? (
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="py-1.5">Dia</th><th className="py-1.5 text-right">Faturamento</th><th className="py-1.5 text-right">Pedidos</th></tr></thead><tbody>{data.byDay.map(row => <tr key={row.date} className="border-t border-[#f0e6d8]"><td className="py-1.5">{row.label}</td><td className="py-1.5 text-right font-semibold">{money(row.revenueCents)}</td><td className="py-1.5 text-right text-muted-foreground">{row.orderCount}</td></tr>)}</tbody></table></div>
        ) : <p className="mt-3 text-sm text-muted-foreground">Sem dados no período.</p>}
      </div>
    </div>
  );
}
