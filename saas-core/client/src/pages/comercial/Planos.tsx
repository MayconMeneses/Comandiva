import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const BASE_INCLUDES = ["Cardápio digital", "Pedidos online", "Pagamento por Pix e cartão"];

export default function Planos() {
  const plansQuery = trpc.public.plans.useQuery();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/comercial" className="text-lg font-bold text-ink">
            MM System Creator
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Escolha o plano do seu restaurante</h1>
        <p className="mt-4 text-ink-soft">
          <strong>14 dias de teste grátis</strong>, sem cartão de crédito. Sem comissão por pedido —
          mensalidade fixa, ponto final.
        </p>

        {plansQuery.isLoading && <p className="mt-12 text-ink-soft">Carregando planos...</p>}
        {plansQuery.isError && (
          <p className="mt-12 text-red-600">Não foi possível carregar os planos agora. Tente novamente em instantes.</p>
        )}

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {plansQuery.data?.map((plan, index) => {
            const highlighted = index === 1 && (plansQuery.data?.length ?? 0) > 1;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-6 text-left ${
                  highlighted ? "border-accent shadow-lg ring-1 ring-accent" : "border-border bg-paper-raised"
                }`}
                style={highlighted ? { background: "color-mix(in srgb, var(--color-accent) 4%, var(--color-paper-raised))" } : undefined}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
                    Mais escolhido
                  </span>
                )}
                <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  14 dias grátis
                </span>
                <h2 className="mt-3 text-xl font-semibold text-ink">{plan.name}</h2>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-ink">{money(plan.priceCents)}</span>
                  <span className="text-ink-soft">/mês</span>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                  {BASE_INCLUDES.map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-600">✓</span> {item}
                    </li>
                  ))}
                  {plan.featureNames.map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-600">✓</span> {item}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/comercial/cadastro/${plan.key}`}
                  className={`mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors ${
                    highlighted ? "bg-accent text-white hover:bg-accent-hover" : "border border-border bg-paper-raised text-ink hover:bg-paper"
                  }`}
                >
                  Assinar {plan.name}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-sm text-ink-soft">Pode trocar de plano quando quiser, direto no seu painel — sem multa.</p>
      </section>
    </div>
  );
}
