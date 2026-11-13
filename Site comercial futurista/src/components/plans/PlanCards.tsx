import { FEATURE_GROUPS, addedIn, type Plan, type PlanKey } from "../../data/plans";
import { PlanCard } from "./PlanCard";

/**
 * Planos na zona escura. Em cada cartão: nome, preço e limites; embaixo só o
 * que o plano ACRESCENTA ao anterior. O indicado pelo "Descubra seu plano"
 * ganha anel azul e selo.
 */
export function PlanCards({ plans, groups = FEATURE_GROUPS, recommended }: { plans: Plan[]; groups?: typeof FEATURE_GROUPS; recommended: PlanKey }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 pt-2 lg:grid-cols-3 lg:gap-6">
      {plans.map((plan, i) => (
        <PlanCard key={plan.key} plan={plan} index={i} previousName={plans[i - 1]?.name} added={addedIn(plans, i, groups)} recommended={plan.key === recommended} />
      ))}
    </div>
  );
}
