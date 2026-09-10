import { Link } from "wouter";
import type { ReactNode, SVGProps } from "react";

const PRIMARY_LINK_CLASSES =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover";
const OUTLINE_LINK_CLASSES =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-border bg-paper-raised px-6 text-sm font-semibold text-ink transition-colors hover:bg-paper";

function Icon({ children, ...props }: { children: ReactNode } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

const IconBolt = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
  </Icon>
);
const IconPalette = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1" fill="currentColor" />
    <circle cx="14" cy="9" r="1" fill="currentColor" />
    <circle cx="16" cy="13" r="1" fill="currentColor" />
    <path d="M12 21a2 2 0 0 1-2-2c0-.6.2-1 .5-1.4.3-.4.5-.8.5-1.3a1.8 1.8 0 0 0-1.8-1.8H9a7 7 0 1 1 7-7" />
  </Icon>
);
const IconCheckShield = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);
const IconHeadset = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M4 13a8 8 0 0 1 16 0" />
    <rect x="3" y="13" width="4" height="6" rx="1.5" />
    <rect x="17" y="13" width="4" height="6" rx="1.5" />
    <path d="M19 19v1a3 3 0 0 1-3 3h-2" />
  </Icon>
);
const IconCard = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19" />
    <path d="M6 15h4" />
  </Icon>
);
const IconGift = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="9" width="18" height="4.5" rx="1" />
    <path d="M5 13.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5" />
    <path d="M12 9v12" />
    <path d="M12 9C9.5 9 8 7.6 8 6a2.5 2.5 0 0 1 4-2c.6.6 1 1.7 1 2" />
    <path d="M12 9c2.5 0 4-1.4 4-3a2.5 2.5 0 0 0-4-2c-.6.6-1 1.7-1 2" />
  </Icon>
);
const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2.5} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);
const IconX = (props: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2.5} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

const DIFERENCIAIS: { icon: (props: SVGProps<SVGSVGElement>) => ReactNode; title: string; description: string }[] = [
  {
    icon: IconBolt,
    title: "Zero comissão por pedido",
    description: "Aplicativo de entrega costuma cobrar até 30% em cima de cada venda. Aqui a mensalidade é fixa — o resto da venda é seu.",
  },
  {
    icon: IconPalette,
    title: "A marca é do seu restaurante",
    description: "Cardápio, checkout e acompanhamento de pedido com a cara do seu negócio — não a de um concorrente na mesma vitrine.",
  },
  {
    icon: IconCheckShield,
    title: "Sistema testado de verdade",
    description: "Não é protótipo nem MVP de vitrine: é o mesmo sistema que roda a operação real de um restaurante, todo santo dia.",
  },
  {
    icon: IconHeadset,
    title: "Sua equipe não fica sozinha",
    description: "A gente acompanha a configuração inicial e pode entrar no seu painel pra ajudar quando você travar — sem pedir sua senha.",
  },
  {
    icon: IconCard,
    title: "Pagamento pronto pra usar",
    description: "Pix e cartão via Mercado Pago, caindo direto na sua conta — sem integração manual, sem taxa escondida.",
  },
  {
    icon: IconGift,
    title: "14 dias grátis, sem cartão",
    description: "Testa o sistema inteiro antes de decidir. Só pedimos os dados de pagamento se você seguir depois do teste.",
  },
];

const COMPARISON = [
  { label: "Comissão por pedido", us: "R$ 0 — mensalidade fixa", them: "Até 30% por venda" },
  { label: "Marca exibida pro cliente", us: "A sua", them: "A do aplicativo" },
  { label: "Dados de contato do seu cliente", us: "Seus, pra sempre", them: "Do aplicativo" },
  { label: "Personalização do cardápio/visual", us: "Total", them: "Quase nenhuma" },
];

const STEPS = [
  { number: "1", title: "Escolha o plano", description: "Compare os recursos e escolha o que faz sentido pro tamanho do seu restaurante." },
  { number: "2", title: "Cadastre seu restaurante", description: "Leva menos de 2 minutos — sem cartão de crédito, sem burocracia." },
  { number: "3", title: "Comece a vender", description: "Nossa equipe configura o sistema com seu cardápio e sua operação, e você já sai vendendo." },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-10 border-b border-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-ink">MM System Creator</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/comercial/planos" className="hidden text-ink-soft hover:text-ink sm:inline">
              Planos
            </Link>
            <Link href="/comercial/planos" className={`${PRIMARY_LINK_CLASSES} h-9 px-4`}>
              Começar agora
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] opacity-70"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent)" }}
        />
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper-raised px-3 py-1 text-xs font-semibold text-accent">
            <IconBolt className="h-3.5 w-3.5" />
            Zero comissão por pedido
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Seu restaurante com sistema próprio — não com o app do concorrente do lado
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-soft">
            Cardápio digital, pedidos, entregas e relatórios com a marca do seu restaurante. Sem pagar
            comissão por venda, sem dividir vitrine com ninguém.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/comercial/planos" className={`${PRIMARY_LINK_CLASSES} text-base`}>
              Ver planos e começar
            </Link>
            <a href="#diferenciais" className={`${OUTLINE_LINK_CLASSES} text-base`}>
              Ver diferenciais
            </a>
          </div>
          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-600" /> 14 dias grátis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-600" /> Sem cartão de crédito
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-600" /> Cancele quando quiser
            </span>
          </p>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Por que trocar o app de entrega pelo seu próprio sistema</h2>
          <p className="mt-3 text-ink-soft">O que faz diferença de verdade no fim do mês.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DIFERENCIAIS.map(item => (
            <div key={item.title} className="rounded-2xl border border-border bg-paper-raised p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparação */}
      <section className="border-y border-border bg-paper-raised/60">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">Sistema próprio x aplicativo de entrega</h2>
            <p className="mt-3 text-ink-soft">Nada contra os apps — só que quem carrega o restaurante no ombro é você.</p>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-paper-raised">
            <div className="grid grid-cols-3 border-b border-border bg-paper text-sm font-semibold text-ink">
              <div className="px-4 py-3">&nbsp;</div>
              <div className="px-4 py-3 text-accent">Com sistema próprio</div>
              <div className="px-4 py-3 text-ink-soft">App de entrega comum</div>
            </div>
            {COMPARISON.map(row => (
              <div key={row.label} className="grid grid-cols-3 border-b border-border text-sm last:border-b-0">
                <div className="px-4 py-4 font-medium text-ink">{row.label}</div>
                <div className="flex items-center gap-2 px-4 py-4 text-ink">
                  <IconCheck className="h-4 w-4 shrink-0 text-emerald-600" /> {row.us}
                </div>
                <div className="flex items-center gap-2 px-4 py-4 text-ink-soft">
                  <IconX className="h-4 w-4 shrink-0 text-red-500" /> {row.them}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Como funciona</h2>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map(step => (
            <div key={step.number} className="text-center sm:text-left">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                {step.number}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="rounded-2xl bg-accent px-8 py-14 text-center text-white">
          <h2 className="text-2xl font-bold sm:text-3xl">Pronto pra vender sem depender de aplicativo de terceiro?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">14 dias grátis, sem cartão de crédito. Cancele quando quiser.</p>
          <div className="mt-8">
            <Link
              href="/comercial/planos"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-8 text-sm font-semibold text-accent shadow-sm transition-colors hover:bg-white/90"
            >
              Ver planos e começar agora
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-soft">
        © {new Date().getFullYear()} MM System Creator.
      </footer>
    </div>
  );
}
