import { FEATURE_GROUPS, LAUNCH_DISCOUNT, SIGNUP_URL, addedIn, type Plan, type PlanKey } from "../../data/plans";
import { formatBRL } from "../../lib/format";
import { track } from "../../lib/track";
import { Ticket } from "../ui/Ticket";
import { Stamp } from "../ui/Stamp";
import { Link } from "wouter";

function Check({ muted = false }: { muted?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`mt-0.5 h-4 w-4 shrink-0 ${muted ? "text-ink-soft" : "text-accent-text"}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Planos como ingressos picotados. Em cima: nome, preço e limites. Embaixo:
 * só o que o plano ACRESCENTA ao anterior ("Tudo do Entrada, mais:") e o
 * botão. O plano indicado pelo "Descubra seu plano" ganha o carimbo, que
 * bate de novo sempre que a indicação muda.
 */
export function PlanCards({ plans, groups = FEATURE_GROUPS, recommended }: { plans: Plan[]; groups?: typeof FEATURE_GROUPS; recommended: PlanKey }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan, i) => {
        const isRec = plan.key === recommended;
        const added = addedIn(plans, i, groups);
        const previous = plans[i - 1];
        return (
          <article key={plan.key} className="relative" aria-label={`Plano ${plan.name}${isRec ? ", recomendado para você" : ""}`}>
            {isRec && (
              <div className="absolute -top-4 right-4 z-10">
                <Stamp key={recommended} text="Recomendado" sub="para você" tone="light" rotate={7} />
              </div>
            )}
            <Ticket
              highlighted={isRec}
              className="h-full"
              top={
                <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">Plano {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold">{plan.name}</h3>
                  <p className="mt-1.5 min-h-[2.5rem] text-sm text-ink-soft">{plan.tagline}</p>
                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-semibold tracking-tight">{formatBRL(plan.priceCents / 100)}</span>
                    <span className="text-sm text-ink-soft">/mês</span>
                  </p>
                  <p className="mt-1 text-xs text-accent-text">
                    {formatBRL(Math.round(plan.priceCents * (1 - LAUNCH_DISCOUNT)) / 100)}/mês nos 2 primeiros meses
                  </p>
                  <dl className="mt-5 grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-wide">
                    <div className="rounded-xl border border-line px-3 py-2">
                      <dt className="text-ink-soft">Usuários</dt>
                      <dd className="mt-0.5 text-ink">{plan.users === null ? "Ilimitados" : `Até ${plan.users}`}</dd>
                    </div>
                    <div className="rounded-xl border border-line px-3 py-2">
                      <dt className="text-ink-soft">Mesas</dt>
                      <dd className="mt-0.5 text-ink">{plan.tables === null ? "Ilimitadas" : plan.tables === 0 ? "—" : `Até ${plan.tables}`}</dd>
                    </div>
                  </dl>
                </>
              }
              bottom={
                <div className="flex h-full flex-col">
                  <p className="text-sm font-semibold text-ink">{previous ? `Tudo do ${previous.name}, mais:` : "Já vem com:"}</p>
                  <ul className="mb-8 mt-3 space-y-2 text-sm text-ink-soft">
                    {added.map(f => (
                      <li key={f.id} className="flex gap-2">
                        <Check />
                        {f.name}
                      </li>
                    ))}
                    <li className="flex gap-2">
                      <Check muted={plan.key === "essencial"} />
                      Manutenção: {plan.maintenance.toLowerCase()}
                    </li>
                  </ul>
                  <Link
                    href={SIGNUP_URL(plan.key)}
                    onClick={() => track("signup_start")}
                    className={`group mt-auto inline-flex items-center justify-between gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-sm font-semibold transition-transform duration-300 active:scale-[0.98] ${
                      isRec ? "bg-accent-strong text-white hover:bg-[#0076e0]" : "border border-line text-ink hover:bg-bg"
                    }`}
                  >
                    Assinar {plan.name}
                    <span
                      aria-hidden="true"
                      className={`grid h-8 w-8 place-items-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 ${
                        isRec ? "bg-white/15" : "bg-white/5"
                      }`}
                    >
                      ↗
                    </span>
                  </Link>
                </div>
              }
            />
          </article>
        );
      })}
    </div>
  );
}
