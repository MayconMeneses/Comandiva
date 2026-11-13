import { Link } from "wouter";
import { FEATURE_GROUPS, addedIn, type PlanKey } from "../../data/plans";
import { usePlans } from "../../lib/usePlans";
import { ArrowIcon } from "../ui/Icons";
import { PlanCard } from "./PlanCard";
import { Marked } from "../ui/Kw";

/** Os 4 itens mais relevantes que cada plano acrescenta (ids de data/plans.ts), na ordem de exibição. */
const MAIN: Record<PlanKey, string[]> = {
  essencial: ["menu", "orders", "payments", "tables_qr"],
  profissional: ["kitchen", "commands", "promotions", "reports_complete"],
  premium: ["events", "reports_advanced", "advanced_team", "audit"],
};

/**
 * Planos na home, em faixa azul-noite: mesmos cartões e preços de /planos
 * (vivos da API, com reserva local), 4 itens por plano e link para a
 * comparação completa.
 */
export function PlansTeaser() {
  const { plans, groups } = usePlans();
  return (
    <section id="planos" className="scroll-mt-20 bg-band px-4 py-24 text-band-ink sm:px-6 md:py-28" aria-labelledby="planos-home-title">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-band-soft">Planos</p>
          <h2 id="planos-home-title" className="mt-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-balance">
            <Marked text="Mensalidade fixa, sem comissão por pedido" phrase="sem comissão por pedido" tone="band" />
          </h2>
          <p className="mt-4 text-band-soft">7 dias grátis assim que seu sistema estiver pronto, sem cartão de crédito. Cancele quando quiser, sem multa e sem fidelidade.</p>
        </div>
        <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-3 lg:gap-6">
          {plans.map((plan, i) => {
            const pool = addedIn(plans, i, groups.length ? groups : FEATURE_GROUPS);
            const picked = MAIN[plan.key].map(id => pool.find(f => f.id === id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
            const added = picked.length ? picked : pool.slice(0, 4);
            return <PlanCard key={plan.key} plan={plan} index={i} previousName={plans[i - 1]?.name} added={added} recommended={plan.key === "profissional"} compact />;
          })}
        </div>
        <p className="mt-10 text-center">
          <Link
            href="/planos"
            className="group inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-band-ink underline decoration-band-soft underline-offset-4 hover:decoration-band-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-ink"
          >
            Comparar todos os recursos
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}
