import { useEffect, useState } from "react";
import { FEATURE_GROUPS, PLANS, type Feature, type Plan, type PlanKey } from "../data/plans";

type ApiPlan = {
  key: PlanKey;
  /** Centavos por acionamento; nulo = inclusa. Ausente em respostas antigas (vale a reserva). */
  maintenanceCents?: number | null;
  name: string;
  priceCents: number;
  active: boolean;
  features: string[];
  limits?: { users?: number | null; tables?: number | null };
};
type ApiResponse = { plans: ApiPlan[]; allFeatures: { featureId: string; name: string }[] };

export type PlansState = { plans: Plan[]; groups: typeof FEATURE_GROUPS; source: "api" | "reserva" };

/**
 * Planos vivos da MESMA API do site comercial atual (`public.plans` no
 * Master): nome, preço, limites e recursos vêm do banco, então o preço
 * exibido é sempre o cobrado. Textos de apoio (tagline, manutenção,
 * descrição dos recursos) continuam no data/plans.ts.
 *
 * - Dentro do Master a chamada é no mesmo endereço (/api/...).
 * - Rodando sozinho, o Vite repassa /api para mmsystem.tech (vite.config.ts).
 * - Se a API falhar ou demorar, fica a reserva local (data/plans.ts).
 */
export function usePlans(): PlansState {
  const [state, setState] = useState<PlansState>({ plans: PLANS, groups: FEATURE_GROUPS, source: "reserva" });

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch("/api/trpc/public.plans", { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(body => {
        const data: ApiResponse = body?.result?.data?.json ?? body?.result?.data;
        if (!data?.plans?.length) throw new Error("resposta vazia");
        const byKey = new Map(data.plans.filter(p => p.active).map(p => [p.key, p]));
        const plans = PLANS.filter(p => byKey.has(p.key)).map(local => {
          const api = byKey.get(local.key)!;
          return {
            ...local,
            name: api.name,
            priceCents: api.priceCents,
            users: api.limits?.users ?? null,
            tables: api.limits?.tables ?? null,
            features: api.features,
            maintenanceCents: api.maintenanceCents === undefined ? local.maintenanceCents : api.maintenanceCents,
          };
        });
        if (!plans.length) throw new Error("nenhum plano ativo conhecido");
        // Recurso novo no banco que o catálogo ainda não descreve: entra num grupo "Outros".
        const known = new Set(FEATURE_GROUPS.flatMap(g => g.features.map(f => f.id)));
        const extra: Feature[] = data.allFeatures
          .filter(f => !known.has(f.featureId))
          .map(f => ({ id: f.featureId, name: f.name, description: "", minPlan: "premium" }));
        const groups = extra.length ? [...FEATURE_GROUPS, { title: "Outros recursos", features: extra }] : FEATURE_GROUPS;
        setState({ plans, groups, source: "api" });
      })
      .catch(() => {
        /* fica a reserva local */
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, []);

  return state;
}
