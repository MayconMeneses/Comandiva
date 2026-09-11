import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import type { ReactNode, SVGProps } from "react";
import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const BASE_INCLUDES = ["Cardápio digital", "Pedidos online", "Pagamento por Pix e cartão"];
const IMPLEMENTATION_FEE_CENTS = 15000;

function Icon({ children, ...props }: { children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}
const IconLock = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="4" y="10.5" width="16" height="10" rx="2" />
    <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
  </Icon>
);
const IconShieldCheck = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2.5} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export default function Planos() {
  const plansQuery = trpc.public.plans.useQuery();

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader />

      {/* Faixa de destaque — assinatura visual logo abaixo do cabeçalho */}
      <div className="h-1" style={{ background: "linear-gradient(90deg, #008cfe, #6146fd, #008cfe)" }} />

      <section className="relative overflow-hidden">
        {/* Textura de pontos — dá profundidade e um ar "premium" sem competir com o conteúdo */}
        <div
          className="pointer-events-none absolute inset-0 -z-20"
          style={{
            backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 45%, transparent) 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
        {/* Brilho de fundo — indigo + azul da marca */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem]"
          style={{
            background:
              "radial-gradient(50% 55% at 50% 0%, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent), radial-gradient(38% 38% at 88% 8%, color-mix(in srgb, #3b82f6 22%, transparent), transparent), radial-gradient(32% 32% at 8% 18%, color-mix(in srgb, #3b82f6 14%, transparent), transparent)",
          }}
        />

        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-raised/80 px-3 py-1 text-xs font-semibold text-accent shadow-sm backdrop-blur">
            <IconShieldCheck className="h-3.5 w-3.5" />
            Ambiente de cadastro seguro
          </span>
          <h1 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">Escolha o plano do seu restaurante</h1>
          <p className="mt-4 text-ink-soft">
            <strong>30 dias de teste grátis</strong> assim que seu sistema estiver pronto (em até 10 dias
            úteis), sem cartão de crédito. Sem comissão por pedido — a mensalidade cobre o aluguel do
            sistema e a hospedagem, ponto final.
          </p>
          <p className="mx-auto mt-3 w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400">
            🎉 Lançamento: 20% de desconto na mensalidade nos 2 primeiros meses
          </p>

          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <IconLock className="h-4 w-4 text-emerald-400" /> Pagamento 100% seguro — Mercado Pago
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconShieldCheck className="h-4 w-4 text-emerald-400" /> Seus dados protegidos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-400" /> Sem fidelidade — cancele quando quiser
            </span>
          </div>

          {plansQuery.isLoading && <p className="mt-12 text-ink-soft">Carregando planos...</p>}
          {plansQuery.isError && (
            <p className="mt-12 text-red-400">Não foi possível carregar os planos agora. Tente novamente em instantes.</p>
          )}

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {plansQuery.data?.map((plan, index) => {
              const highlighted = index === 1 && (plansQuery.data?.length ?? 0) > 1;
              const maintenanceIncluded = plan.key !== "essencial";
              return (
                <div key={plan.id} className="relative">
                  {highlighted && (
                    <div
                      className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] opacity-60 blur-2xl"
                      style={{ background: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }}
                    />
                  )}
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border p-6 text-left ${
                      highlighted ? "border-accent shadow-xl ring-1 ring-accent" : "border-border bg-paper-raised shadow-sm"
                    }`}
                    style={
                      highlighted
                        ? { background: "color-mix(in srgb, var(--color-accent) 4%, var(--color-paper-raised))" }
                        : undefined
                    }
                  >
                    {highlighted && (
                      <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
                        Mais escolhido
                      </span>
                    )}
                    <span className="w-fit rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                      30 dias grátis
                    </span>
                    <h2 className="mt-3 text-xl font-semibold text-ink">{plan.name}</h2>
                    <div className="mt-3">
                      <span className="text-3xl font-bold text-ink">{money(plan.priceCents)}</span>
                      <span className="text-ink-soft">/mês</span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-400">
                      {money(Math.round(plan.priceCents * 0.8))}/mês nos 2 primeiros meses
                    </p>

                    <ul className="mt-5 space-y-2 text-sm text-ink-soft">
                      {BASE_INCLUDES.map(item => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-0.5 text-emerald-400">✓</span> {item}
                        </li>
                      ))}
                      {plan.featureNames.map(item => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-0.5 text-emerald-400">✓</span> {item}
                        </li>
                      ))}
                      {maintenanceIncluded ? (
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-emerald-400">✓</span> Manutenção inclusa
                        </li>
                      ) : (
                        <li className="flex items-start gap-2">
                          <span className="mt-0.5 text-amber-400">•</span> Manutenção sob consulta — R$100 por acionamento
                        </li>
                      )}
                    </ul>

                    <Link
                      href={`/comercial/cadastro/${plan.key}`}
                      className={`mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all duration-200 ${
                        highlighted
                          ? "bg-gradient-to-r from-[#008cfe] to-[#6146fd] text-white shadow-lg shadow-[#6146fd]/20 hover:-translate-y-0.5 hover:brightness-110"
                          : "border border-border bg-paper-raised text-ink hover:bg-paper"
                      }`}
                    >
                      Assinar {plan.name}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-accent/30 bg-paper-raised/90 p-5 text-left shadow-sm backdrop-blur">
            <p className="text-sm font-semibold text-ink">
              Taxa de implementação: <span className="text-accent">{money(IMPLEMENTATION_FEE_CENTS)}</span>
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Cobrimos a configuração completa: subir seus produtos no sistema, testar tudo até funcionar
              100% e entregar pronto pra vender. Cobrada uma única vez, no cadastro.
            </p>
          </div>

          <p className="mt-6 text-sm text-ink-soft">Pode trocar de plano quando quiser, direto no seu painel — sem multa.</p>
        </div>
      </section>

      <ComercialFooter />
    </div>
  );
}
