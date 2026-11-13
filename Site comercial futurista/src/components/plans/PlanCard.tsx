import { motion, useReducedMotion } from "motion/react";
import { Link } from "wouter";
import { LAUNCH_DISCOUNT, SIGNUP_URL, maintenanceText, type Feature, type Plan } from "../../data/plans";
import { formatBRL } from "../../lib/format";
import { track } from "../../lib/track";
import { ArrowIcon } from "../ui/Icons";

function Check({ hot }: { hot: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={"mt-0.5 h-4 w-4 shrink-0 " + (hot ? "text-warm" : "text-band-soft")} fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Cartão de plano sobre a zona escura. O recomendado leva anel azul, selo com
 * o ponto tomate e botão preenchido; os outros ficam contornados. Ao passar o
 * mouse o cartão sobe e a borda clareia (com movimento reduzido, fica parado).
 */
export function PlanCard({
  plan,
  index,
  previousName,
  added,
  recommended,
  compact = false,
}: {
  plan: Plan;
  index: number;
  previousName?: string;
  added: Feature[];
  recommended: boolean;
  /** Versão da home: sem a linha de manutenção (fica em /planos). */
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const border = recommended ? "border-accent ring-2 ring-accent" : "border-band-line hover:border-band-soft";

  return (
    <motion.article
      aria-label={"Plano " + plan.name + (recommended ? ", recomendado para você" : "")}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some" }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      className="relative"
    >
      <div
        className={"relative flex h-full flex-col rounded-3xl border bg-band-raised p-6 transition-[transform,border-color] duration-200 ease-out motion-safe:hover:-translate-y-1 sm:p-7 " + border}
      >
        {recommended && (
          <motion.span
            key="rec"
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={
              "absolute -top-3.5 right-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold " +
              (compact ? "border-mark bg-mark text-ink" : "border-band-soft bg-band text-band-ink")
            }
          >
            <span aria-hidden="true" className={"h-2 w-2 rounded-full " + (compact ? "bg-ink" : "bg-warm")} />
            Recomendado
          </motion.span>
        )}
        <p className="font-mono text-xs text-band-soft">Plano {String(index + 1).padStart(2, "0")}</p>
        <h3 className="mt-2 font-display text-2xl font-semibold text-band-ink">{plan.name}</h3>
        <p className="mt-1.5 min-h-[2.5rem] text-sm text-band-soft">{plan.tagline}</p>
        <p className="mt-5 flex items-baseline gap-1.5">
          <span className={"font-display text-4xl font-semibold tracking-tight [font-variant-numeric:tabular-nums] sm:text-5xl " + (compact && recommended ? "text-mark" : "text-band-ink")}>{formatBRL(plan.priceCents / 100)}</span>
          <span className="text-sm text-band-soft">/mês</span>
        </p>
        <p className="mt-1.5 text-xs text-band-soft [font-variant-numeric:tabular-nums]">
          <strong className="font-semibold text-band-ink">{formatBRL(Math.round(plan.priceCents * (1 - LAUNCH_DISCOUNT)) / 100)}/mês</strong> nos 2 primeiros meses
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-2 font-mono text-xs">
          <div className="rounded-xl border border-band-line px-3 py-2">
            <dt className="text-band-soft">Usuários</dt>
            <dd className="mt-0.5 text-band-ink">{plan.users === null ? "Ilimitados" : "Até " + plan.users}</dd>
          </div>
          <div className="rounded-xl border border-band-line px-3 py-2">
            <dt className="text-band-soft">Mesas</dt>
            <dd className="mt-0.5 text-band-ink">{plan.tables === null ? "Ilimitadas" : plan.tables === 0 ? "Não incluso" : "Até " + plan.tables}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-1 flex-col border-t border-dashed border-band-line pt-5">
          <p className="text-sm font-semibold text-band-ink">{previousName ? "Tudo do " + previousName + ", mais:" : "Já vem com:"}</p>
          <ul className="mb-8 mt-3 space-y-2 text-sm text-band-soft">
            {added.map(f => (
              <li key={f.id} className="flex gap-2">
                <Check hot={recommended} />
                {f.name}
              </li>
            ))}
            {!compact && (
              <li className="flex gap-2">
                <Check hot={recommended} />
                Manutenção: {maintenanceText(plan).replace(/^./, c => c.toLowerCase())}
              </li>
            )}
          </ul>
          <Link
            href={SIGNUP_URL(plan.key)}
            onClick={() => track("signup_start")}
            className={
              "group mt-auto inline-flex min-h-12 items-center justify-between gap-3 rounded-xl px-5 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-band-ink " +
              (recommended ? "bg-accent text-white hover:bg-accent-hover" : "border border-band-soft text-band-ink hover:bg-band-line")
            }
          >
            Assinar {plan.name}
            <ArrowIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
