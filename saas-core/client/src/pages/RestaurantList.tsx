import { PanelLayout } from "@/components/PanelLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { copyToClipboard } from "@/lib/clipboard";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Link } from "wouter";

const STATUS_OPTIONS = ["", "active", "suspended", "cancelled"] as const;
const PLAN_OPTIONS = ["", "essencial", "profissional", "premium"] as const;
const NEW_PLAN_OPTIONS = ["essencial", "profissional", "premium"] as const;

const CANCELLED_HIDE_DAYS = 10;

export default function RestaurantList() {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("");
  const [planKey, setPlanKey] = useState<(typeof PLAN_OPTIONS)[number]>("");
  // Cancelados somem da lista sozinhos 10 dias depois (ver
  // listRestaurantsForPanel) — nunca apagados, só escondidos por padrão
  // pra não acumular; esse toggle reexibe pra quem precisar consultar.
  const [includeHidden, setIncludeHidden] = useState(false);
  const utils = trpc.useUtils();
  const list = trpc.masterPanel.restaurants.list.useQuery({
    status: status || undefined,
    planKey: planKey || undefined,
    includeHidden,
  });

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [newPlanKey, setNewPlanKey] = useState<(typeof NEW_PLAN_OPTIONS)[number]>("essencial");
  const [copied, setCopied] = useState(false);

  const create = trpc.masterPanel.restaurants.create.useMutation({
    onSuccess: () => { void utils.masterPanel.restaurants.list.invalidate(); },
  });

  const resetForm = () => {
    setName("");
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setNewPlanKey("essencial");
    setCopied(false);
    create.reset();
  };

  const closeForm = () => {
    setIsCreating(false);
    resetForm();
  };

  return (
    <PanelLayout>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-ink">Restaurantes</h1>
        <div className="flex gap-2">
          <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className="h-9 rounded-lg border border-border bg-paper-raised px-2 text-sm">
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <select value={planKey} onChange={event => setPlanKey(event.target.value as typeof planKey)} className="h-9 rounded-lg border border-border bg-paper-raised px-2 text-sm">
            <option value="">Todos os planos</option>
            <option value="essencial">Essencial</option>
            <option value="profissional">Profissional</option>
            <option value="premium">Premium</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
            <input type="checkbox" checked={includeHidden} onChange={event => setIncludeHidden(event.target.checked)} className="h-4 w-4 accent-accent" />
            Mostrar cancelados ocultos ({CANCELLED_HIDE_DAYS}+ dias)
          </label>
          {!isCreating ? <Button onClick={() => setIsCreating(true)}>Novo restaurante</Button> : null}
        </div>
      </div>

      {isCreating ? (
        <div className="mt-4 rounded-xl border border-border bg-paper-raised p-4">
          {create.data ? (
            <div>
              <h2 className="text-base font-semibold text-ink">Restaurante criado</h2>
              <p className="mt-1 text-sm text-ink-soft">
                "{name}" cadastrado no plano {create.data.planKey}, período de teste iniciado.
              </p>
              <div className="mt-3 rounded-lg border border-amber-500 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Copie esta chave agora — ela não será mostrada de novo</p>
                <p className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-ink">{create.data.apiKey}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await copyToClipboard(create.data!.apiKey);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? "Copiado!" : "Copiar chave"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={closeForm}>Fechar</Button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-base font-semibold text-ink">Novo restaurante</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-ink-soft">Nome *</label>
                  <Input className="mt-1" value={name} onChange={event => setName(event.target.value)} placeholder="Nome do restaurante" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft">Plano inicial</label>
                  <select
                    value={newPlanKey}
                    onChange={event => setNewPlanKey(event.target.value as typeof newPlanKey)}
                    className="mt-1 h-9 w-full rounded-lg border border-border bg-paper-raised px-2 text-sm"
                  >
                    <option value="essencial">Essencial</option>
                    <option value="profissional">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft">Nome de contato</label>
                  <Input className="mt-1" value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Quem é o contato" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft">E-mail de contato</label>
                  <Input className="mt-1" type="email" value={contactEmail} onChange={event => setContactEmail(event.target.value)} placeholder="contato@exemplo.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink-soft">Telefone de contato</label>
                  <Input className="mt-1" value={contactPhone} onChange={event => setContactPhone(event.target.value)} placeholder="(85) 90000-0000" />
                </div>
              </div>
              {create.error ? <p className="mt-3 text-xs text-red-700">{create.error.message}</p> : null}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={closeForm} disabled={create.isPending}>Cancelar</Button>
                <Button
                  disabled={name.trim().length < 2 || create.isPending}
                  onClick={() =>
                    create.mutate({
                      name: name.trim(),
                      planKey: newPlanKey,
                      contactName: contactName.trim() || undefined,
                      contactEmail: contactEmail.trim() || undefined,
                      contactPhone: contactPhone.trim() || undefined,
                    })
                  }
                >
                  {create.isPending ? "Criando…" : "Criar restaurante"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-paper-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status assinatura</th>
              <th className="px-4 py-3">Status restaurante</th>
              <th className="px-4 py-3">Cadastrado em</th>
              <th className="px-4 py-3">Próxima cobrança</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map(row => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-paper">
                <td className="px-4 py-3">
                  <Link href={`/restaurantes/${row.id}`} className="font-medium text-accent hover:underline">{row.name}</Link>
                  {row.contactEmail ? <p className="text-xs text-ink-soft">{row.contactEmail}</p> : null}
                  {!row.deploymentUrl ? <p className="mt-1 text-xs font-medium text-amber-700">⚠ sem deployment configurado</p> : null}
                </td>
                <td className="px-4 py-3">{row.plan.name}</td>
                <td className="px-4 py-3"><Badge status={row.subscription.status}>{row.subscription.status}</Badge></td>
                <td className="px-4 py-3">
                  <Badge status={row.status}>{row.status}</Badge>
                  {row.status === "cancelled" && row.cancelledAt ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      {(() => {
                        const days = Math.floor((Date.now() - row.cancelledAt) / (24 * 60 * 60 * 1000));
                        return days >= CANCELLED_HIDE_DAYS ? `Oculto por padrão (cancelado há ${days} dias)` : `Cancelado há ${days} dia${days === 1 ? "" : "s"} · some da lista em ${CANCELLED_HIDE_DAYS - days} dia${CANCELLED_HIDE_DAYS - days === 1 ? "" : "s"}`;
                      })()}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink-soft">{new Date(row.createdAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-ink-soft">{row.subscription.nextBillingAt ? new Date(row.subscription.nextBillingAt).toLocaleDateString("pt-BR") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.isLoading ? <p className="p-4 text-sm text-ink-soft">Carregando…</p> : null}
        {list.data && !list.data.length ? <p className="p-4 text-sm text-ink-soft">Nenhum restaurante encontrado com esse filtro.</p> : null}
      </div>
    </PanelLayout>
  );
}
