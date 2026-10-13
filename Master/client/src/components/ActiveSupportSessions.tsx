import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";

/**
 * Sessões de Modo Suporte em andamento neste restaurante, com "Encerrar agora".
 * O restaurante confere a sessão com o Painel Master a cada ~15 s, então o acesso
 * cai em poucos segundos depois do clique (não precisa esperar o prazo de 15 min).
 */
export function ActiveSupportSessions({ restaurantId }: { restaurantId: number }) {
  const utils = trpc.useUtils();
  const sessions = trpc.masterPanel.support.listActive.useQuery(undefined, { refetchInterval: 10_000 });
  const endSession = trpc.masterPanel.support.end.useMutation({ onSuccess: () => utils.masterPanel.support.listActive.invalidate() });

  const mine = (sessions.data ?? []).filter(session => session.restaurantId === restaurantId);
  if (!mine.length) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="text-xs font-semibold uppercase tracking-wide">Suporte em andamento</p>
      <ul className="mt-2 space-y-2">
        {mine.map(session => (
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {session.adminEmail} · desde {session.usedAt ? new Date(session.usedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"} · até{" "}
              {new Date(session.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <Button variant="danger" disabled={endSession.isPending} onClick={() => endSession.mutate({ supportSessionId: session.id })}>
              {endSession.isPending ? "Encerrando…" : "Encerrar agora"}
            </Button>
          </li>
        ))}
      </ul>
      {endSession.error ? <p className="mt-2 text-xs text-red-700">{endSession.error.message}</p> : null}
    </div>
  );
}
