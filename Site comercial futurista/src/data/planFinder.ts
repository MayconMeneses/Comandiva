import type { PlanKey } from "./plans";

export type FinderAnswers = { tables: boolean; team: "small" | "medium" | "large"; advanced: boolean };

/** Regra simples, baseada só nos limites e recursos reais de cada plano (ver seed-plans.ts). */
export function recommend(a: FinderAnswers): PlanKey {
  if (a.advanced || a.team === "large") return "premium";
  if (a.tables || a.team === "medium") return "profissional";
  return "essencial";
}
