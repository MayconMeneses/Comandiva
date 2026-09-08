import { PanelLayout } from "@/components/PanelLayout";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

type AuditRow = { id: number; createdAt: number; actorLabel: string; action: string; entityType: string | null; entityId: number | null };

const ENTITY_TYPE_OPTIONS = ["", "restaurant"] as const;

export default function AuditLog() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState<(typeof ENTITY_TYPE_OPTIONS)[number]>("");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const query = trpc.masterPanel.auditLog.list.useQuery({
    action: action || undefined,
    entityType: entityType || undefined,
    beforeId: cursor,
    limit: 50,
  });

  // react-query v5 removeu o onSuccess de useQuery — acumular via effect é o jeito idiomático agora.
  useEffect(() => {
    if (!query.data) return;
    setRows(previous => (cursor ? [...previous, ...query.data] : query.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const loadMore = () => {
    const last = rows[rows.length - 1];
    if (last) setCursor(last.id);
  };

  return (
    <PanelLayout>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">Auditoria</h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={action}
            onChange={event => {
              setAction(event.target.value);
              setCursor(undefined);
              setRows([]);
            }}
            placeholder="Filtrar por ação..."
            className="h-9 rounded-lg border border-border bg-paper-raised px-2 text-sm"
          />
          <select
            value={entityType}
            onChange={event => {
              setEntityType(event.target.value as typeof entityType);
              setCursor(undefined);
              setRows([]);
            }}
            className="h-9 rounded-lg border border-border bg-paper-raised px-2 text-sm"
          >
            <option value="">Todas as entidades</option>
            <option value="restaurant">Restaurante</option>
          </select>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-paper-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Quem</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-ink-soft">{new Date(row.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3">{row.actorLabel}</td>
                <td className="px-4 py-3">{row.action}</td>
                <td className="px-4 py-3 text-ink-soft">{row.entityType ? `${row.entityType} #${row.entityId}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {query.isLoading && !rows.length ? <p className="p-4 text-sm text-ink-soft">Carregando…</p> : null}
        {!query.isLoading && !rows.length ? <p className="p-4 text-sm text-ink-soft">Nenhum evento de auditoria ainda.</p> : null}
      </div>
      {rows.length ? (
        <div className="mt-3">
          <Button variant="outline" onClick={loadMore} disabled={query.isFetching}>{query.isFetching ? "Carregando…" : "Carregar mais"}</Button>
        </div>
      ) : null}
    </PanelLayout>
  );
}
