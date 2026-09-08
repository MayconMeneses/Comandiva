const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  trial: "bg-sky-50 text-sky-700",
  payment_pending: "bg-amber-50 text-amber-700",
  past_due: "bg-amber-50 text-amber-700",
  cancel_at_period_end: "bg-amber-50 text-amber-700",
  canceled: "bg-slate-100 text-slate-600",
  suspended: "bg-red-50 text-red-700",
  ended: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-600",
};

export function Badge({ status, children }: { status: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-600"}`}>{children}</span>;
}
