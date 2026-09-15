import { LockedFeatureFullPage } from "@/components/admin/LockedFeature";
import { Loading } from "@/components/admin/shared";
import { trpc } from "@/lib/trpc";
import { STATUS_LABELS } from "@shared/orderDomain";
import { History } from "lucide-react";

const CHANGE_TYPE_LABELS: Record<string, string> = {
  ORDER_INFO_UPDATED: "Dados do pedido editados",
  ATTACHMENT_UPDATED: "Anexo/comprovante enviado",
  ATTACHMENT_REMOVED: "Anexo/comprovante removido",
  ORDER_NOTES_CLEARED: "Observações apagadas",
  PAYMENT_REFUNDED: "Pagamento marcado como reembolsado",
  ORDER_ARCHIVED: "Pedido removido da lista (arquivado)",
};

export default function AuditLog() {
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const locked = snapshot.data?.lockedFeatures.audit;
  const query = trpc.admin.recent.useQuery({ limit: 100 }, { enabled: !snapshot.isLoading && !locked });
  const entries = query.data ?? [];

  if (snapshot.isLoading) return <Loading />;
  if (locked) return <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} featureId="audit" />;

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Rastreabilidade</p>
          <h2 className="mt-2 font-display text-3xl font-bold">Auditoria</h2>
          <p className="mt-1 text-sm text-muted-foreground">As últimas {entries.length || 100} ações registradas sobre pedidos — quem fez, o quê e quando. Este registro nunca é editado ou apagado, nem pelo sistema.</p>
        </div>
        <History className="h-8 w-8 shrink-0 text-[#b4472d]" />
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando auditoria…</p>
      ) : query.error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{query.error.message}</p>
      ) : entries.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#e4d8c8] text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Quem</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => (
                <tr key={`${entry.kind}-${entry.id}`} className="border-b border-[#f0e6d8] last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium">{entry.orderPublicCode}</td>
                  <td className="px-4 py-2.5">
                    {entry.kind === "STATUS" ? (
                      <>Status alterado para <strong>{STATUS_LABELS[entry.status as keyof typeof STATUS_LABELS] ?? entry.status}</strong>{entry.note ? <span className="text-muted-foreground"> — {entry.note}</span> : null}</>
                    ) : (
                      <>{CHANGE_TYPE_LABELS[entry.changeType] ?? entry.changeType}</>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{entry.actorName ?? "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#d9cdbc] p-4 text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
      )}
    </section>
  );
}
