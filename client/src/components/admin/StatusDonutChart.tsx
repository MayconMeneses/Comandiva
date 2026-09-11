const STATUS_COLOR: Record<string, string> = { PENDING: "#f59e0b", ACCEPTED: "#0ea5e9", PREPARING: "#8b5cf6", OUT_FOR_DELIVERY: "#6366f1", READY_FOR_PICKUP: "#10b981", COMPLETED: "#78716c", CANCELLED: "#ef4444" };

const RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Rosca de pedidos por status — mesma contagem que já vinha em barras horizontais, só em formato proporcional (fatia = participação no total), com o total de pedidos no centro. */
export default function StatusDonutChart({ byStatus, labels }: { byStatus: Array<{ status: string; count: number | string }>; labels: Record<string, string> }) {
  const total = byStatus.reduce((sum, item) => sum + Number(item.count), 0);
  const segments = byStatus.filter(item => Number(item.count) > 0);
  let cumulative = 0;

  return <div className="flex flex-wrap items-center gap-8">
    <svg viewBox="0 0 160 160" width={160} height={160} role="img" aria-label="Proporção de pedidos por status">
      <circle cx={80} cy={80} r={RADIUS} fill="none" stroke="#efe7dd" strokeWidth={20} />
      {total > 0 && segments.map(item => {
        const length = (Number(item.count) / total) * CIRCUMFERENCE;
        const offset = -cumulative;
        cumulative += length;
        return <circle key={item.status} cx={80} cy={80} r={RADIUS} fill="none" stroke={STATUS_COLOR[item.status] ?? "#a8a29e"} strokeWidth={20} strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} strokeDashoffset={offset} transform="rotate(-90 80 80)"><title>{`${labels[item.status] ?? item.status}: ${item.count} (${Math.round((Number(item.count) / total) * 100)}%)`}</title></circle>;
      })}
      <text x={80} y={77} textAnchor="middle" fontSize={26} fontWeight="bold" fill="#241b16">{total}</text>
      <text x={80} y={95} textAnchor="middle" fontSize={11} fill="#8a7a68">pedidos</text>
    </svg>
    <div className="min-w-[180px] flex-1 space-y-2.5">
      {segments.length ? segments.map(item => <div key={item.status} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[item.status] ?? "#a8a29e" }} />{labels[item.status] ?? item.status}</span><span className="font-semibold">{item.count} · {total ? Math.round((Number(item.count) / total) * 100) : 0}%</span></div>) : <p className="text-sm text-muted-foreground">Ainda não há pedidos no período selecionado.</p>}
    </div>
  </div>;
}
