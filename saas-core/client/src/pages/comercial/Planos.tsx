import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const BASE_INCLUDES = ["Cardápio digital", "Pedidos online", "Pagamento por Pix e cartão"];
const IMPLEMENTATION_FEE_CENTS = 75000;
const IMPLEMENTATION_FEE_LIST_CENTS = 120000;

export default function Planos() {
  const plansQuery = trpc.public.plans.useQuery();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ComercialHeader />

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Escolha o plano do seu restaurante</h1>
        <p className="mt-4 text-ink-soft">
          <strong>30 dias de teste grátis</strong> assim que seu sistema estiver pronto (em até 10 dias
          úteis), sem cartão de crédito. Sem comissão por pedido — a mensalidade cobre o aluguel do
          sistema e a hospedagem, ponto final.
        </p>
        <p className="mx-auto mt-3 w-fit rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
          🎉 Lançamento: 20% de desconto na mensalidade nos 2 primeiros meses
        </p>

        {plansQuery.isLoading && <p className="mt-12 text-ink-soft">Carregando planos...</p>}
        {plansQuery.isError && (
          <p className="mt-12 text-red-600">Não foi possível carregar os planos agora. Tente novamente em instantes.</p>
        )}

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {plansQuery.data?.map((plan, index) => {
            const highlighted = index === 1 && (plansQuery.data?.length ?? 0) > 1;
            const maintenanceIncluded = plan.key !== "essencial";
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
                  30 dias grátis
                </span>
                <h2 className="mt-3 text-xl font-semibold text-ink">{plan.name}</h2>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-ink">{money(plan.priceCents)}</span>
                  <span className="text-ink-soft">/mês</span>
                </div>
                <p className="mt-1 text-xs text-emerald-700">
                  {money(Math.round(plan.priceCents * 0.8))}/mês nos 2 primeiros meses
                </p>

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
                  {maintenanceIncluded ? (
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-600">✓</span> Manutenção inclusa
                    </li>
                  ) : (
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-amber-600">•</span> Manutenção sob consulta — R$100 por acionamento
                    </li>
                  )}
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

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-accent/30 bg-accent/5 p-5 text-left">
          <p className="text-sm font-semibold text-ink">
            Taxa de implementação: <span className="line-through text-ink-soft">{money(IMPLEMENTATION_FEE_LIST_CENTS)}</span>{" "}
            <span className="text-accent">{money(IMPLEMENTATION_FEE_CENTS)}</span>{" "}
            <span className="text-xs font-normal text-ink-soft">(tempo limitado)</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Cobrimos a configuração completa: subir seus produtos no sistema, testar tudo até funcionar
            100% e entregar pronto pra vender. Cobrada uma única vez, no cadastro.
          </p>
        </div>

        <p className="mt-6 text-sm text-ink-soft">Pode trocar de plano quando quiser, direto no seu painel — sem multa.</p>
      </section>

      <ComercialFooter />
    </div>
  );
}
