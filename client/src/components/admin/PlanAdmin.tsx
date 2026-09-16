import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Lock, Loader2, ReceiptText, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateLabel = (ms: number) => new Date(ms).toLocaleDateString("pt-BR");

const LIMIT_LABELS: Record<string, string> = { users: "Contas de equipe", tables: "Mesas" };

const STATUS_LABELS: Record<string, string> = {
  trial: "Período de teste",
  active: "Ativo",
  payment_pending: "Pagamento pendente",
  past_due: "Pagamento atrasado",
  cancel_at_period_end: "Cancelamento agendado",
  canceled: "Cancelado",
  suspended: "Suspenso",
  ended: "Encerrado",
  unconfigured: "Licenciamento não configurado",
};

type PendingChange = { key: string; name: string; priceCents: number; direction: "upgrade" | "downgrade" } | null;

export default function PlanAdmin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const plans = trpc.admin.plans.useQuery();
  const paymentHistory = trpc.admin.billingPaymentHistory.useQuery();
  const forceSync = trpc.admin.forceSync.useMutation({ onSuccess: () => void utils.admin.mySnapshot.invalidate() });

  const [pendingChange, setPendingChange] = useState<PendingChange>(null);
  const [payerEmail, setPayerEmail] = useState(user?.email ?? "");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const refreshAfterChange = () => { void utils.admin.mySnapshot.invalidate(); void utils.admin.billingPaymentHistory.invalidate(); };

  const changePlan = trpc.admin.changePlan.useMutation({
    onSuccess: result => {
      setPendingChange(null);
      if ("checkoutUrl" in result) { window.location.href = result.checkoutUrl; return; }
      if ("scheduled" in result) toast.success(`Troca de plano agendada para ${dateLabel(result.effectiveAt)}.`);
      else toast.success("Plano atualizado — os novos recursos já estão liberados.");
      refreshAfterChange();
    },
    onError: error => toast.error(error.message),
  });
  const cancelSubscription = trpc.admin.cancelSubscription.useMutation({
    onSuccess: result => { setConfirmCancel(false); setCancelReason(""); toast.success(`Cancelamento agendado para ${dateLabel(result.effectiveAt)}. Seu acesso continua até lá.`); refreshAfterChange(); },
    onError: error => toast.error(error.message),
  });
  const reactivateSubscription = trpc.admin.reactivateSubscription.useMutation({
    onSuccess: () => { toast.success("Assinatura reativada."); refreshAfterChange(); },
    onError: error => toast.error(error.message),
  });

  if (snapshot.isLoading) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (snapshot.error || !snapshot.data) return <p className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Não foi possível carregar os dados do plano.</p>;

  const data = snapshot.data;
  const allFeatureIds = Object.keys(FEATURE_CATALOG);
  const lockedIds = new Set(Object.keys(data.lockedFeatures));
  const currentPlanEntry = plans.data?.find(candidate => candidate.key === data.planKey);
  const currentPosition = currentPlanEntry?.position ?? 0;
  const isCancelScheduled = data.status === "cancel_at_period_end";
  const isPastDue = data.status === "past_due" || data.status === "suspended";

  const openChangeDialog = (plan: NonNullable<typeof plans.data>[number]) => {
    setPendingChange({ key: plan.key, name: plan.name, priceCents: plan.priceCents, direction: plan.position > currentPosition ? "upgrade" : "downgrade" });
  };

  const confirmChange = () => {
    if (!pendingChange) return;
    if (!payerEmail.trim()) { toast.error("Informe um e-mail para o pagamento."); return; }
    changePlan.mutate({ planKey: pendingChange.key, payerEmail: payerEmail.trim() });
  };

  const cancelPendingDowngrade = () => {
    if (!currentPlanEntry) return;
    changePlan.mutate({ planKey: currentPlanEntry.key, payerEmail: payerEmail.trim() || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Meu plano</p>
            <h1 className="mt-2 font-display text-3xl font-bold">{data.planName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Status: <strong>{STATUS_LABELS[data.status] ?? data.status}</strong>
              {data.currentPeriodEnd ? <> · período atual até {dateLabel(data.currentPeriodEnd)}</> : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.syncedAt ? <>Última sincronização: {new Date(data.syncedAt).toLocaleString("pt-BR")} {data.lastSyncOk ? "· ok" : "· com falha (mantendo último estado bom conhecido)"}</> : "Ainda não sincronizado com o serviço central."}
            </p>
          </div>
          <Button variant="outline" disabled={forceSync.isPending} onClick={() => forceSync.mutate()} className="h-10 rounded-xl border-[#d8c8b4] bg-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${forceSync.isPending ? "animate-spin" : ""}`} />Sincronizar agora
          </Button>
        </div>

        {data.scheduledPlanKey && data.currentPeriodEnd && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>Seu plano atual (<strong>{data.planName}</strong>) continua ativo até <strong>{dateLabel(data.currentPeriodEnd)}</strong>. Depois dessa data, você passa automaticamente para o plano <strong>{data.scheduledPlanName}</strong>.</p>
              <Button variant="ghost" size="sm" disabled={changePlan.isPending} onClick={cancelPendingDowngrade} className="mt-2 h-7 px-2 text-xs text-amber-900 underline hover:bg-amber-100">Cancelar essa troca e continuar no {data.planName}</Button>
            </div>
          </div>
        )}
        {isCancelScheduled && data.currentPeriodEnd && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <p>Sua assinatura foi cancelada e continua ativa até <strong>{dateLabel(data.currentPeriodEnd)}</strong>. Depois dessa data, seu acesso é encerrado.</p>
              <Button variant="ghost" size="sm" disabled={reactivateSubscription.isPending} onClick={() => reactivateSubscription.mutate()} className="mt-2 h-7 px-2 text-xs text-red-900 underline hover:bg-red-100">{reactivateSubscription.isPending ? "Reativando…" : "Reativar assinatura"}</Button>
            </div>
          </div>
        )}
        {isPastDue && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Não conseguimos confirmar seu último pagamento. Verifique a forma de pagamento cadastrada no Mercado Pago para evitar a suspensão do acesso.</p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6">
        <h2 className="font-display text-xl font-bold">Recursos</h2>
        <div className="mt-4 divide-y divide-[#eee4d8]">
          {allFeatureIds.map(featureId => {
            const label = FEATURE_CATALOG[featureId]!;
            const locked = lockedIds.has(featureId);
            const requiredPlanName = data.lockedFeatures[featureId]?.requiredPlanName;
            return (
              <div key={featureId} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{label.name}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{label.description}</p>
                  </div>
                  {locked ? (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#f3e2d8] px-3 py-1 text-xs font-semibold text-primary">
                      <Lock className="h-3.5 w-3.5" />{requiredPlanName ?? "Plano superior"}
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />Liberado
                    </span>
                  )}
                </div>
                {locked && label.benefits.length ? (
                  <ul className="mt-2 space-y-1 pl-1">
                    {label.benefits.map(benefit => (
                      <li key={benefit} className="text-xs leading-5 text-[#8a5c3f]">· {benefit}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6">
        <h2 className="font-display text-xl font-bold">Planos disponíveis</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upgrade libera os recursos na hora. Downgrade só passa a valer no fim do período atual — nada é apagado.</p>
        {plans.isLoading ? (
          <div className="mt-4 grid place-items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {(plans.data ?? []).map(plan => {
              const isCurrent = plan.key === data.planKey && !data.scheduledPlanKey;
              const isScheduledTarget = plan.key === data.scheduledPlanKey;
              const isUpgrade = plan.position > currentPosition;
              const isDowngrade = plan.position < currentPosition;
              return (
                <div key={plan.key} className={`flex flex-col rounded-2xl border p-4 ${isCurrent ? "border-primary bg-[#fdf1ea]" : isScheduledTarget ? "border-amber-300 bg-amber-50" : "border-[#eee4d8] bg-white"}`}>
                  <p className="text-sm font-bold uppercase tracking-wide text-primary">{plan.name}</p>
                  <p className="mt-1 text-2xl font-bold">{money(plan.priceCents)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                  <p className="mt-2 text-xs text-muted-foreground">{plan.features.length} recurso(s) liberado(s)</p>
                  <div className="mt-4 flex-1" />
                  {isCurrent ? (
                    <span className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#f3e2d8] px-3 py-2 text-xs font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Seu plano atual</span>
                  ) : isScheduledTarget ? (
                    <span className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900"><Clock3 className="h-3.5 w-3.5" />Agendado</span>
                  ) : isUpgrade ? (
                    <Button onClick={() => openChangeDialog(plan)} className="mt-2 rounded-xl bg-primary hover:bg-primary-hover"><Sparkles className="mr-1.5 h-4 w-4" />Fazer upgrade</Button>
                  ) : isDowngrade ? (
                    <Button variant="outline" onClick={() => openChangeDialog(plan)} className="mt-2 rounded-xl border-[#d8c8b4] bg-white">Fazer downgrade</Button>
                  ) : null}
                </div>
              );
            })}
            {plans.data && !plans.data.length ? <p className="text-sm text-muted-foreground">Catálogo de planos indisponível no momento.</p> : null}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6">
        <h2 className="font-display text-xl font-bold">Limites do plano</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(LIMIT_LABELS).map(([resourceKey, label]) => {
            const limit = data.limits[resourceKey];
            const used = data.usage[resourceKey as keyof typeof data.usage] ?? 0;
            const overLimit = limit != null && used > limit;
            return (
              <div key={resourceKey} className={`rounded-2xl border p-4 ${overLimit ? "border-amber-300 bg-amber-50" : "border-[#eee4d8] bg-white"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-bold">{used} <span className="text-sm font-normal text-muted-foreground">/ {limit == null ? "ilimitado" : limit}</span></p>
                {overLimit && <p className="mt-1 text-xs text-amber-900">Acima do limite do plano atual — nada foi removido, mas você não consegue criar mais até fazer upgrade ou reduzir.</p>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Cobranças e assinatura</h2>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(current => !current)} className="h-8 rounded-lg border-[#d8c8b4] bg-white text-xs"><ReceiptText className="mr-1.5 h-3.5 w-3.5" />{showHistory ? "Ocultar histórico" : "Ver histórico de cobranças"}</Button>
        </div>
        {showHistory && (
          <div className="mt-4 space-y-2">
            {paymentHistory.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : paymentHistory.data?.length ? (
              paymentHistory.data.map(payment => (
                <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eee4d8] bg-white px-3 py-2 text-xs">
                  <span>{new Date(payment.createdAt).toLocaleDateString("pt-BR")}</span>
                  <span className="font-semibold">{money(payment.amountCents)}</span>
                  <span className={payment.status === "paid" ? "text-emerald-700" : payment.status === "failed" ? "text-red-700" : "text-muted-foreground"}>{payment.status === "paid" ? "Pago" : payment.status === "failed" ? "Falhou" : payment.status === "refunded" ? "Estornado" : "Pendente"}</span>
                </div>
              ))
            ) : <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada ainda.</p>}
          </div>
        )}
        {!isCancelScheduled && data.status !== "canceled" && (
          <div className="mt-5 border-t border-[#eee4d8] pt-4">
            <Button variant="ghost" onClick={() => setConfirmCancel(true)} className="h-8 px-2 text-xs text-red-700 hover:bg-red-50 hover:text-red-800">Cancelar assinatura</Button>
          </div>
        )}
      </div>

      <Dialog open={Boolean(pendingChange)} onOpenChange={open => { if (!open) setPendingChange(null); }}>
        <DialogContent className="rounded-2xl bg-[#fffdf8] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{pendingChange?.direction === "upgrade" ? "Confirmar upgrade" : "Confirmar downgrade"}</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              {pendingChange?.direction === "upgrade"
                ? <>Você está mudando de <strong>{data.planName}</strong> para <strong>{pendingChange.name}</strong>. Os novos recursos são liberados assim que você concluir o pagamento{plans.data?.find(p => p.key === data.planKey)?.priceCents ? " (ou na hora, se já tiver uma assinatura ativa)" : ""}. A próxima cobrança será de <strong>{money(pendingChange.priceCents)}/mês</strong>.</>
                : pendingChange ? <>Você está mudando de <strong>{data.planName}</strong> para <strong>{pendingChange.name}</strong> ({money(pendingChange.priceCents)}/mês). Seu plano atual continua ativo até <strong>{data.currentPeriodEnd ? dateLabel(data.currentPeriodEnd) : "o fim do período atual"}</strong> — a troca só vale depois disso, e nenhum dado é apagado.</> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Label htmlFor="payer-email">E-mail para o pagamento</Label>
            <Input id="payer-email" type="email" value={payerEmail} onChange={event => setPayerEmail(event.target.value)} placeholder="seu@email.com" className="mt-1.5 h-10 rounded-xl bg-white" />
          </div>
          {changePlan.error && <p className="mt-2 text-sm text-red-700">{changePlan.error.message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingChange(null)}>Cancelar</Button>
            <Button disabled={changePlan.isPending} onClick={confirmChange} className="rounded-xl bg-primary hover:bg-primary-hover">{changePlan.isPending ? "Confirmando…" : <>Confirmar <ArrowRight className="ml-1.5 h-4 w-4" /></>}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="rounded-2xl bg-[#fffdf8] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Cancelar assinatura</DialogTitle>
            <DialogDescription className="text-sm leading-6">
              Seu acesso continua normalmente até <strong>{data.currentPeriodEnd ? dateLabel(data.currentPeriodEnd) : "o fim do período atual"}</strong> (você já pagou por esse período). Depois disso, o acesso ao painel é encerrado. Nenhum dado do restaurante é apagado — você pode reativar antes dessa data a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Input id="cancel-reason" value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Nos ajuda a melhorar" className="mt-1.5 h-10 rounded-xl bg-white" />
          </div>
          {cancelSubscription.error && <p className="mt-2 text-sm text-red-700">{cancelSubscription.error.message}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Voltar</Button>
            <Button disabled={cancelSubscription.isPending} onClick={() => cancelSubscription.mutate({ reason: cancelReason.trim() || undefined })} className="rounded-xl bg-red-700 hover:bg-red-800">{cancelSubscription.isPending ? "Cancelando…" : "Confirmar cancelamento"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
