import { useState } from "react";
import { PanelLayout } from "@/components/PanelLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const centsToReaisInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const reaisInputToCents = (value: string) => {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

type PlanRow = ReturnType<typeof usePlansData>["plans"][number];

function usePlansData() {
  const query = trpc.masterPanel.plans.list.useQuery();
  return { plans: query.data?.plans ?? [], features: query.data?.features ?? [], query };
}

export default function Plans() {
  const utils = trpc.useUtils();
  const { plans, features, query } = usePlansData();

  // Rascunhos locais dos campos editáveis — só viram mutation quando o usuário confirma
  // (preço/posição, botão "Salvar") ou sai do campo (limites, onBlur).
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [positionDrafts, setPositionDrafts] = useState<Record<number, string>>({});
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});

  const invalidate = () => utils.masterPanel.plans.list.invalidate();
  const savePlanMutation = trpc.masterPanel.plans.savePlan.useMutation({ onSuccess: invalidate });
  const toggleFeatureMutation = trpc.masterPanel.plans.setPlanFeature.useMutation({ onSuccess: invalidate });
  const setLimitMutation = trpc.masterPanel.plans.setPlanLimit.useMutation({ onSuccess: invalidate });

  if (query.isLoading) return <PanelLayout><p className="text-sm text-ink-soft">Carregando…</p></PanelLayout>;
  if (query.error || !query.data) return <PanelLayout><p className="text-sm text-red-700">Não foi possível carregar os planos.</p></PanelLayout>;

  const priceValue = (plan: PlanRow) => priceDrafts[plan.id] ?? centsToReaisInput(plan.priceCents);
  const positionValue = (plan: PlanRow) => positionDrafts[plan.id] ?? String(plan.position);
  const limitKey = (planId: number, resourceKey: string) => `${planId}:${resourceKey}`;
  const limitValue = (plan: PlanRow, resourceKey: "users" | "tables") => {
    const key = limitKey(plan.id, resourceKey);
    if (key in limitDrafts) return limitDrafts[key];
    const raw = plan.limits[resourceKey];
    return raw === null || raw === undefined ? "" : String(raw);
  };

  const savePlanHeader = (plan: PlanRow) => {
    const cents = reaisInputToCents(priceValue(plan));
    const position = Number(positionValue(plan));
    if (cents === null || cents < 0 || !Number.isFinite(position) || position <= 0) return;
    savePlanMutation.mutate(
      { id: plan.id, name: plan.name, priceCents: cents, currency: plan.currency, position, active: plan.active },
      {
        onSuccess: () => {
          setPriceDrafts(prev => { const next = { ...prev }; delete next[plan.id]; return next; });
          setPositionDrafts(prev => { const next = { ...prev }; delete next[plan.id]; return next; });
        },
      },
    );
  };

  const saveLimit = (plan: PlanRow, resourceKey: "users" | "tables") => {
    const key = limitKey(plan.id, resourceKey);
    const raw = limitDrafts[key];
    if (raw === undefined) return; // usuário não mexeu no campo, nada pra salvar
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    setLimitMutation.mutate(
      { planId: plan.id, resourceKey, limitValue: value },
      { onSuccess: () => setLimitDrafts(prev => { const next = { ...prev }; delete next[key]; return next; }) },
    );
  };

  const mutationError = savePlanMutation.error ?? toggleFeatureMutation.error ?? setLimitMutation.error;

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Planos e features</h1>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-paper-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Feature</th>
              {plans.map(plan => (
                <th key={plan.id} className="min-w-[160px] px-4 py-3 align-top">
                  <p className="text-sm font-semibold normal-case text-ink">{plan.name}</p>
                  <p className="mt-0.5 font-normal normal-case text-ink-soft">{money(plan.priceCents)}/mês · atual</p>
                  <div className="mt-2 flex flex-col gap-1.5 font-normal normal-case">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-soft">R$</span>
                      <Input
                        value={priceValue(plan)}
                        onChange={event => setPriceDrafts(prev => ({ ...prev, [plan.id]: event.target.value }))}
                        className="h-7 w-20 px-2 text-xs"
                        inputMode="decimal"
                        aria-label={`Preço de ${plan.name}`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-ink-soft">Posição</span>
                      <Input
                        value={positionValue(plan)}
                        onChange={event => setPositionDrafts(prev => ({ ...prev, [plan.id]: event.target.value }))}
                        className="h-7 w-14 px-2 text-xs"
                        inputMode="numeric"
                        aria-label={`Posição de ${plan.name}`}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      disabled={savePlanMutation.isPending}
                      onClick={() => savePlanHeader(plan)}
                    >
                      {savePlanMutation.isPending ? "Salvando…" : "Salvar"}
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map(feature => (
              <tr key={feature.featureId} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{feature.name}</p>
                  {feature.description ? <p className="text-xs text-ink-soft">{feature.description}</p> : null}
                </td>
                {plans.map(plan => (
                  <td key={plan.id} className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent"
                      checked={plan.features.includes(feature.featureId)}
                      disabled={toggleFeatureMutation.isPending}
                      onChange={event => toggleFeatureMutation.mutate({ planId: plan.id, featureId: feature.featureId, enabled: event.target.checked })}
                      aria-label={`${feature.name} no plano ${plan.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-4 py-3 font-medium">Limites (usuários / mesas)</td>
              {plans.map(plan => (
                <td key={plan.id} className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Input
                      value={limitValue(plan, "users")}
                      onChange={event => setLimitDrafts(prev => ({ ...prev, [limitKey(plan.id, "users")]: event.target.value }))}
                      onBlur={() => saveLimit(plan, "users")}
                      placeholder="ilimitado"
                      className="h-7 w-16 px-2 text-center text-xs"
                      inputMode="numeric"
                      aria-label={`Limite de usuários — ${plan.name}`}
                    />
                    <span className="text-ink-soft">/</span>
                    <Input
                      value={limitValue(plan, "tables")}
                      onChange={event => setLimitDrafts(prev => ({ ...prev, [limitKey(plan.id, "tables")]: event.target.value }))}
                      onBlur={() => saveLimit(plan, "tables")}
                      placeholder="ilimitado"
                      className="h-7 w-16 px-2 text-center text-xs"
                      inputMode="numeric"
                      aria-label={`Limite de mesas — ${plan.name}`}
                    />
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {mutationError ? <p className="mt-2 text-xs text-red-700">{mutationError.message}</p> : null}
    </PanelLayout>
  );
}
