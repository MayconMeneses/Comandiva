import { useState } from "react";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(cents / 100);

// Mesmo número "até 30%" já usado na seção de diferenciais desta mesma
// página (comissão típica de app de entrega) — não é um dado novo, só
// reaproveitado aqui de forma interativa. Mensalidade de referência: o
// plano de entrada (R$ 99,90), o mesmo "a partir de" usado no resto do site.
const COMMISSION_RATE = 0.3;
const BASE_PLAN_CENTS = 9990;
const MIN_REVENUE_CENTS = 300_000; // R$ 3.000
const MAX_REVENUE_CENTS = 10_000_000; // R$ 100.000
const STEP_CENTS = 100_000; // R$ 1.000
const DEFAULT_REVENUE_CENTS = 2_000_000; // R$ 20.000

export function SavingsCalculator() {
  const [revenueCents, setRevenueCents] = useState(DEFAULT_REVENUE_CENTS);
  const commissionCents = Math.round(revenueCents * COMMISSION_RATE);
  const savingsCents = Math.max(0, commissionCents - BASE_PLAN_CENTS);

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-paper-raised p-6 sm:p-8">
      <label htmlFor="savings-revenue" className="block text-sm font-semibold text-ink">
        Quanto seu restaurante fatura por mês em pedidos?
      </label>
      <div className="mt-4 flex items-center gap-4">
        <input
          id="savings-revenue"
          type="range"
          min={MIN_REVENUE_CENTS}
          max={MAX_REVENUE_CENTS}
          step={STEP_CENTS}
          value={revenueCents}
          onChange={event => setRevenueCents(Number(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-accent"
          aria-describedby="savings-revenue-value"
        />
        <span id="savings-revenue-value" className="w-28 shrink-0 text-right font-mono text-lg font-bold text-ink tabular-nums">
          {money(revenueCents)}
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-paper p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Com app de entrega (até 30% de comissão)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">{money(commissionCents)}<span className="text-sm font-normal text-ink-soft">/mês</span></p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Com o MM System Creator</p>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">{money(BASE_PLAN_CENTS)}<span className="text-sm font-normal text-ink-soft">/mês fixo</span></p>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Economia estimada de <span className="font-mono font-bold text-emerald-400 tabular-nums">{money(savingsCents)}</span> por mês — todo mês, não só numa promoção.
      </p>
      <p className="mt-2 text-center text-xs text-ink-soft/70">
        Estimativa educativa a partir do plano de entrada e de uma comissão comum de mercado — o valor exato do seu app de entrega pode variar.
      </p>
    </div>
  );
}
