import { PanelLayout } from "@/components/PanelLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { copyToClipboard } from "@/lib/clipboard";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useParams } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const PLAN_KEYS = ["essencial", "profissional", "premium"] as const;
const SUBSCRIPTION_STATUSES = ["trial", "active", "payment_pending", "past_due", "cancel_at_period_end", "canceled", "suspended", "ended"] as const;
const RESTAURANT_STATUSES = ["active", "suspended", "cancelled"] as const;
const SUBSCRIPTION_EVENT_LABEL: Record<string, string> = {
  created: "Assinatura criada (cadastro do restaurante)",
  plan_changed: "Plano alterado (operador)",
  status_changed: "Status alterado (operador)",
  plan_upgraded: "Upgrade aplicado",
  downgrade_scheduled: "Downgrade agendado",
  downgrade_applied: "Downgrade aplicado",
  downgrade_cancelled: "Downgrade cancelado",
  checkout_started: "Checkout iniciado",
  cancellation_scheduled: "Cancelamento agendado",
  cancellation_undone: "Cancelamento desfeito",
  cancellation_finalized: "Cancelamento efetivado",
  mercadopago_preapproval_created: "Assinatura Mercado Pago criada",
  mercadopago_status_changed: "Status sincronizado do Mercado Pago",
  plan_activated_from_payment: "Plano ativado (pagamento confirmado)",
};

type Tab = "dados" | "plano" | "pagamentos";

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const restaurantId = Number(id);
  const utils = trpc.useUtils();
  const detail = trpc.masterPanel.restaurants.detail.useQuery({ restaurantId });
  const [tab, setTab] = useState<Tab>("dados");
  const [pendingPlan, setPendingPlan] = useState<(typeof PLAN_KEYS)[number] | null>(null);
  const [pendingStatus, setPendingStatus] = useState<(typeof SUBSCRIPTION_STATUSES)[number] | null>(null);
  const [pendingSupportEntry, setPendingSupportEntry] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [deploymentUrlInput, setDeploymentUrlInput] = useState("");
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [contactNameInput, setContactNameInput] = useState("");
  const [contactEmailInput, setContactEmailInput] = useState("");
  const [contactPhoneInput, setContactPhoneInput] = useState("");
  const [pendingRestaurantStatus, setPendingRestaurantStatus] = useState<(typeof RESTAURANT_STATUSES)[number] | null>(null);
  const [pendingRotateKey, setPendingRotateKey] = useState(false);
  const [pendingMarkDelivered, setPendingMarkDelivered] = useState(false);
  const [rotatedApiKey, setRotatedApiKey] = useState<string | null>(null);
  const [copiedRotatedKey, setCopiedRotatedKey] = useState(false);

  const invalidate = () => { void utils.masterPanel.restaurants.detail.invalidate({ restaurantId }); void utils.masterPanel.restaurants.list.invalidate(); };
  const assignPlan = trpc.masterPanel.restaurants.assignPlan.useMutation({ onSuccess: () => { invalidate(); setPendingPlan(null); } });
  const updateStatus = trpc.masterPanel.restaurants.updateSubscriptionStatus.useMutation({ onSuccess: () => { invalidate(); setPendingStatus(null); } });
  const updateDeploymentUrl = trpc.masterPanel.restaurants.updateDeploymentUrl.useMutation({ onSuccess: invalidate });
  const updateContact = trpc.masterPanel.restaurants.updateContact.useMutation({ onSuccess: () => { invalidate(); setIsEditingContact(false); } });
  const setRestaurantStatus = trpc.masterPanel.restaurants.setStatus.useMutation({ onSuccess: () => { invalidate(); setPendingRestaurantStatus(null); } });
  const rotateApiKey = trpc.masterPanel.restaurants.rotateApiKey.useMutation({
    onSuccess: data => { setRotatedApiKey(data.apiKey); setCopiedRotatedKey(false); setPendingRotateKey(false); },
  });
  const markDelivered = trpc.masterPanel.restaurants.markDelivered.useMutation({ onSuccess: () => { invalidate(); setPendingMarkDelivered(false); } });
  const forceSyncRemote = trpc.masterPanel.restaurants.forceSyncRemote.useMutation();
  const startSupport = trpc.masterPanel.support.start.useMutation({
    onSuccess: data => { window.open(data.entryUrl, "_blank", "noopener,noreferrer"); setPendingSupportEntry(false); },
  });
  const startBilling = trpc.masterPanel.billing.startMercadoPagoSubscription.useMutation({ onSuccess: invalidate });
  const subscriptionEvents = trpc.masterPanel.restaurants.subscriptionEvents.useQuery({ restaurantId }, { enabled: tab === "plano" });

  if (detail.isLoading) return <PanelLayout><p className="text-sm text-ink-soft">Carregando…</p></PanelLayout>;
  if (detail.error || !detail.data) return <PanelLayout><p className="text-sm text-red-700">Restaurante não encontrado.</p></PanelLayout>;

  const { restaurant, subscription, payments, auditEntries } = detail.data;

  return (
    <PanelLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">{restaurant.name}</h1>
          <p className="text-sm text-ink-soft">{restaurant.contactEmail ?? "sem e-mail de contato"}</p>
        </div>
        <Badge status={restaurant.status}>{restaurant.status}</Badge>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border">
        {(["dados", "plano", "pagamentos"] as const).map(candidate => (
          <button
            key={candidate}
            onClick={() => setTab(candidate)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${tab === candidate ? "border-accent text-accent" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {candidate}
          </button>
        ))}
      </div>

      {tab === "dados" ? (
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-paper-raised p-4 text-sm">
          {isEditingContact ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-ink-soft">Nome</label>
                <Input className="mt-1" value={nameInput} onChange={event => setNameInput(event.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Nome de contato</label>
                <Input className="mt-1" value={contactNameInput} onChange={event => setContactNameInput(event.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">E-mail de contato</label>
                <Input className="mt-1" type="email" value={contactEmailInput} onChange={event => setContactEmailInput(event.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-soft">Telefone de contato</label>
                <Input className="mt-1" value={contactPhoneInput} onChange={event => setContactPhoneInput(event.target.value)} />
              </div>
              {updateContact.error ? <p className="text-xs text-red-700 sm:col-span-2">{updateContact.error.message}</p> : null}
              <div className="flex gap-2 sm:col-span-2">
                <Button
                  disabled={nameInput.trim().length < 2 || updateContact.isPending}
                  onClick={() =>
                    updateContact.mutate({
                      restaurantId,
                      name: nameInput.trim(),
                      contactName: contactNameInput.trim() || undefined,
                      contactEmail: contactEmailInput.trim() || undefined,
                      contactPhone: contactPhoneInput.trim() || undefined,
                    })
                  }
                >
                  {updateContact.isPending ? "Salvando…" : "Salvar"}
                </Button>
                <Button variant="ghost" onClick={() => setIsEditingContact(false)} disabled={updateContact.isPending}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div>
              <p><span className="text-ink-soft">Nome:</span> {restaurant.name}</p>
              <p><span className="text-ink-soft">Contato:</span> {restaurant.contactName ?? "—"} · {restaurant.contactEmail ?? "—"} · {restaurant.contactPhone ?? "—"}</p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setNameInput(restaurant.name);
                  setContactNameInput(restaurant.contactName ?? "");
                  setContactEmailInput(restaurant.contactEmail ?? "");
                  setContactPhoneInput(restaurant.contactPhone ?? "");
                  setIsEditingContact(true);
                }}
              >
                Editar dados
              </Button>
            </div>
          )}
          <p><span className="text-ink-soft">Cadastrado em:</span> {new Date(restaurant.createdAt).toLocaleString("pt-BR")}</p>

          <div className="mt-3 rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Status do restaurante (conta)</p>
            <p className="mt-1 text-xs text-ink-soft">
              Isto é diferente do status da assinatura/cobrança (aba "plano") — aqui é a conta em si: ativa, suspensa (bloqueia acesso)
              ou cancelada.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={restaurant.status}>{restaurant.status}</Badge>
              <div className="flex flex-wrap gap-2">
                {RESTAURANT_STATUSES.map(statusOption => (
                  <Button
                    key={statusOption}
                    variant={restaurant.status === statusOption ? "primary" : "outline"}
                    disabled={restaurant.status === statusOption}
                    onClick={() => setPendingRestaurantStatus(statusOption)}
                  >
                    {statusOption}
                  </Button>
                ))}
              </div>
            </div>
            {setRestaurantStatus.error ? <p className="mt-2 text-xs text-red-700">{setRestaurantStatus.error.message}</p> : null}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Entrega / teste grátis</p>
            <p className="mt-1 text-xs text-ink-soft">
              O teste grátis de 30 dias só começa a contar quando o restaurante é marcado como entregue aqui — nunca
              no cadastro. Prazo combinado: até {restaurant.deliveryDueAt ? new Date(restaurant.deliveryDueAt).toLocaleDateString("pt-BR") : "—"}
              {" "}(10 dias úteis do cadastro, podendo ser antes).
            </p>
            {restaurant.deliveredAt ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Entregue em {new Date(restaurant.deliveredAt).toLocaleString("pt-BR")} — teste grátis em andamento.
              </p>
            ) : (
              <>
                <Button className="mt-2" onClick={() => setPendingMarkDelivered(true)}>Marcar como entregue</Button>
                {markDelivered.error ? <p className="mt-2 text-xs text-red-700">{markDelivered.error.message}</p> : null}
              </>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">API key</p>
            <p className="mt-1 text-xs text-ink-soft">Prefixo atual: <span className="font-mono">{restaurant.apiKeyPrefix}</span>. Rotacionar gera uma chave nova e invalida a antiga imediatamente.</p>
            {rotatedApiKey ? (
              <div className="mt-2 rounded-lg border border-amber-500 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Copie esta chave agora — ela não será mostrada de novo</p>
                <p className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-ink">{rotatedApiKey}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await copyToClipboard(rotatedApiKey);
                        setCopiedRotatedKey(true);
                      } catch {
                        setCopiedRotatedKey(false);
                      }
                    }}
                  >
                    {copiedRotatedKey ? "Copiado!" : "Copiar chave"}
                  </Button>
                  <Button onClick={() => setRotatedApiKey(null)}>Fechar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" className="mt-2" onClick={() => setPendingRotateKey(true)}>Rotacionar API key</Button>
            )}
            {rotateApiKey.error ? <p className="mt-2 text-xs text-red-700">{rotateApiKey.error.message}</p> : null}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Modo suporte</p>
            <p className="mt-1 text-xs text-ink-soft">
              Dados operacionais (pedidos, cardápio, mesas) não ficam guardados aqui — o Modo Suporte abre o painel
              administrativo de verdade direto no deployment deste restaurante, sem precisar da senha dele. Acesso
              completo, exceto Pix/gateways de pagamento e gestão de outras contas admin/staff; cada alteração feita
              fica registrada na auditoria.
            </p>
            {isEditingUrl || !restaurant.deploymentUrl ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input placeholder="https://mmsystemcreator.exemplo.com" value={deploymentUrlInput} onChange={event => setDeploymentUrlInput(event.target.value)} className="max-w-xs" />
                <Button
                  disabled={!deploymentUrlInput.trim() || updateDeploymentUrl.isPending}
                  onClick={() => updateDeploymentUrl.mutate({ restaurantId, deploymentUrl: deploymentUrlInput.trim() }, { onSuccess: () => setIsEditingUrl(false) })}
                >
                  {updateDeploymentUrl.isPending ? "Salvando…" : "Salvar URL"}
                </Button>
                {restaurant.deploymentUrl ? <Button variant="ghost" onClick={() => setIsEditingUrl(false)}>Cancelar</Button> : null}
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-soft">{restaurant.deploymentUrl}</span>
                <Button variant="outline" onClick={() => { setDeploymentUrlInput(restaurant.deploymentUrl ?? ""); setIsEditingUrl(true); }}>Editar URL</Button>
                <Button onClick={() => setPendingSupportEntry(true)}>Entrar em modo suporte</Button>
              </div>
            )}
            {updateDeploymentUrl.error ? <p className="mt-2 text-xs text-red-700">{updateDeploymentUrl.error.message}</p> : null}
            {startSupport.error ? <p className="mt-2 text-xs text-red-700">{startSupport.error.message}</p> : null}
          </div>
          {auditEntries.length ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Últimas ações</p>
              <ul className="mt-1 space-y-1">
                {auditEntries.map(entry => (
                  <li key={entry.id} className="text-xs text-ink-soft">{new Date(entry.createdAt).toLocaleString("pt-BR")} · {entry.actorLabel} · {entry.action}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "plano" && subscription ? (
        <div className="mt-4 space-y-4 rounded-xl border border-border bg-paper-raised p-4 text-sm">
          <p><span className="text-ink-soft">Plano atual:</span> <strong>{subscription.plan.name}</strong> ({money(subscription.plan.priceCents)}/mês)</p>
          <p><span className="text-ink-soft">Status da assinatura:</span> <Badge status={subscription.subscription.status}>{subscription.subscription.status}</Badge></p>
          <p><span className="text-ink-soft">Período atual até:</span> {new Date(subscription.subscription.currentPeriodEnd).toLocaleDateString("pt-BR")}</p>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Trocar plano</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PLAN_KEYS.map(key => (
                <Button key={key} variant={subscription.plan.key === key ? "primary" : "outline"} disabled={subscription.plan.key === key} onClick={() => setPendingPlan(key)}>
                  {key}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Trocar status da assinatura</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBSCRIPTION_STATUSES.map(statusOption => (
                <Button key={statusOption} variant={subscription.subscription.status === statusOption ? "primary" : "outline"} disabled={subscription.subscription.status === statusOption} onClick={() => setPendingStatus(statusOption)}>
                  {statusOption}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Sincronização com o deployment</p>
            <p className="mt-1 text-xs text-ink-soft">
              O deployment deste restaurante sincroniza plano/features sozinho a cada poucos minutos — uma troca de
              plano ou rotação de API key acima já vale automaticamente, sem precisar disto. Use só se quiser aplicar
              agora, sem esperar.
            </p>
            <Button
              variant="outline"
              className="mt-2"
              disabled={!restaurant.deploymentUrl || forceSyncRemote.isPending}
              onClick={() => forceSyncRemote.mutate({ restaurantId })}
            >
              {forceSyncRemote.isPending ? "Sincronizando…" : "Forçar sincronização agora"}
            </Button>
            {!restaurant.deploymentUrl ? <p className="mt-2 text-xs text-ink-soft">Configure a URL de deployment (acima) pra habilitar.</p> : null}
            {forceSyncRemote.data ? (
              <p className={`mt-2 text-xs ${forceSyncRemote.data.triggered ? "text-emerald-700" : "text-red-700"}`}>
                {forceSyncRemote.data.triggered ? "Sincronizado com sucesso." : forceSyncRemote.data.error}
              </p>
            ) : null}
            {forceSyncRemote.error ? <p className="mt-2 text-xs text-red-700">{forceSyncRemote.error.message}</p> : null}
          </div>

          <div className="rounded-lg border border-border bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Cobrança automática</p>
            {subscription.subscription.gateway === "MERCADO_PAGO" && subscription.subscription.gatewaySubscriptionId ? (
              <p className="mt-1 text-xs text-ink-soft">Mercado Pago conectado (assinatura {subscription.subscription.gatewaySubscriptionId}). O status acima reflete o que o Mercado Pago avisa automaticamente.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-ink-soft">Ainda não conectado — o restaurante precisa abrir o link e autorizar a cobrança recorrente no cartão dele.</p>
                <Button className="mt-2" disabled={startBilling.isPending} onClick={() => startBilling.mutate({ restaurantId, backUrl: window.location.href })}>
                  {startBilling.isPending ? "Gerando link…" : "Configurar cobrança (Mercado Pago)"}
                </Button>
              </>
            )}
            {startBilling.error ? <p className="mt-2 text-xs text-red-700">{startBilling.error.message}</p> : null}
            {startBilling.data ? (
              <p className="mt-2 text-xs">
                Link gerado — envie pro dono do restaurante autorizar: <a className="text-accent underline" href={startBilling.data.authorizationUrl} target="_blank" rel="noopener noreferrer">{startBilling.data.authorizationUrl}</a>
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Histórico de mudanças</p>
            {subscriptionEvents.isLoading ? (
              <p className="mt-1 text-xs text-ink-soft">Carregando…</p>
            ) : subscriptionEvents.data?.length ? (
              <ul className="mt-2 space-y-1.5">
                {subscriptionEvents.data.map(event => (
                  <li key={event.id} className="text-xs text-ink-soft">
                    {new Date(event.createdAt).toLocaleString("pt-BR")} · {SUBSCRIPTION_EVENT_LABEL[event.eventType] ?? event.eventType}
                    {event.actor ? ` · ${event.actor}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-ink-soft">Nenhuma mudança registrada ainda.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "pagamentos" ? (
        <div className="mt-4 rounded-xl border border-border bg-paper-raised p-4 text-sm">
          {payments.length ? (
            <ul className="space-y-2">
              {payments.map(payment => (
                <li key={payment.id} className="flex justify-between border-b border-border pb-2 last:border-0">
                  <span>{new Date(payment.createdAt).toLocaleDateString("pt-BR")} · {payment.gateway}</span>
                  <span className="font-medium">{money(payment.amountCents)} · <Badge status={payment.status}>{payment.status}</Badge></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">Nenhum pagamento registrado ainda — a cobrança automática via Mercado Pago já está integrada; isto aparece assim que o primeiro ciclo real for cobrado.</p>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingPlan)}
        title="Trocar plano"
        description={`Mudar o plano deste restaurante para "${pendingPlan}"? Isso libera/bloqueia features imediatamente na próxima sincronização do restaurante.`}
        pending={assignPlan.isPending}
        onCancel={() => setPendingPlan(null)}
        onConfirm={() => pendingPlan && assignPlan.mutate({ restaurantId, planKey: pendingPlan })}
      />
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title="Trocar status da assinatura"
        description={`Mudar o status da assinatura para "${pendingStatus}"?`}
        pending={updateStatus.isPending}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => pendingStatus && updateStatus.mutate({ restaurantId, status: pendingStatus })}
      />
      <ConfirmDialog
        open={Boolean(pendingRestaurantStatus)}
        title="Trocar status do restaurante"
        description={`Mudar o status da CONTA deste restaurante para "${pendingRestaurantStatus}"? Isso é diferente do status da assinatura/cobrança.`}
        danger={pendingRestaurantStatus === "suspended" || pendingRestaurantStatus === "cancelled"}
        pending={setRestaurantStatus.isPending}
        onCancel={() => setPendingRestaurantStatus(null)}
        onConfirm={() => pendingRestaurantStatus && setRestaurantStatus.mutate({ restaurantId, status: pendingRestaurantStatus })}
      />
      <ConfirmDialog
        open={pendingRotateKey}
        title="Rotacionar API key"
        description="Gerar uma API key nova para este restaurante? A chave antiga para de funcionar imediatamente — o deployment dele precisa ser atualizado com a nova chave."
        confirmLabel="Rotacionar"
        danger
        pending={rotateApiKey.isPending}
        onCancel={() => setPendingRotateKey(false)}
        onConfirm={() => rotateApiKey.mutate({ restaurantId })}
      />
      <ConfirmDialog
        open={pendingMarkDelivered}
        title="Marcar como entregue"
        description="Confirma que a configuração deste restaurante (cardápio, config geral) está pronta? A partir de agora, o teste grátis de 30 dias passa a contar — essa ação não pode ser desfeita."
        confirmLabel="Marcar como entregue"
        pending={markDelivered.isPending}
        onCancel={() => setPendingMarkDelivered(false)}
        onConfirm={() => markDelivered.mutate({ restaurantId })}
      />
      <ConfirmDialog
        open={pendingSupportEntry}
        title="Entrar em modo suporte"
        description={`Abrir o painel administrativo de "${restaurant.name}" numa aba nova, com acesso completo (exceto Pix/pagamento/contas)? A entrada e cada alteração feita ficam registradas na auditoria.`}
        confirmLabel="Entrar"
        pending={startSupport.isPending}
        onCancel={() => setPendingSupportEntry(false)}
        onConfirm={() => startSupport.mutate({ restaurantId })}
      />
    </PanelLayout>
  );
}
