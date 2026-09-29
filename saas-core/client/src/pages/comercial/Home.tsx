import { Link } from "wouter";
import type { ReactNode, SVGProps } from "react";
import { COMMERCIAL_PAGE_META } from "@shared/commercialPageMeta";
import { usePageMeta } from "@/lib/usePageMeta";
import { ComercialHeader } from "./ComercialHeader";
import { ComercialFooter } from "./ComercialFooter";
import { Reveal } from "./Reveal";
import { SavingsCalculator } from "./SavingsCalculator";

// Organization junto com o SoftwareApplication existente, num único bloco
// JSON-LD via @graph (forma padrão de combinar mais de uma entidade
// schema.org na mesma página) — ajuda o Google a reconhecer "MM System
// Creator" como uma entidade/marca, não só como um produto de software
// solto. Só dado real/confirmado: nome, URL, logo — nada de endereço,
// telefone ou perfil social que não exista de verdade.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "MM System Creator",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Sistema para restaurante com cardápio digital, pedidos online, entregas e pagamento por Pix e cartão — sem comissão por pedido, com a marca do seu restaurante.",
      offers: {
        "@type": "Offer",
        price: "99.99",
        priceCurrency: "BRL",
        url: "https://mmsystem.tech/comercial/planos",
      },
      author: { "@type": "Person", name: "Maycon Meneses" },
    },
    {
      "@type": "Organization",
      name: "MM System Creator",
      url: "https://mmsystem.tech/comercial",
      logo: "https://mmsystem.tech/mm-logo-full.png",
    },
  ],
};

const PRIMARY_LINK_CLASSES =
  "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#008cfe] to-[#6146fd] px-6 text-sm font-semibold text-white shadow-lg shadow-[#6146fd]/20 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110";
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
const IconCoin = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M14.5 9.3c0-1-1-1.8-2.5-1.8s-2.5.9-2.5 2 1 1.6 2.5 2 2.5.9 2.5 2-1 2-2.5 2-2.5-.8-2.5-1.8" />
  </Icon>
);
const IconGear = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a7.4 7.4 0 0 0 0-3l2-1.4-2-3.4-2.3.8a7.3 7.3 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.3 7.3 0 0 0-2.6 1.5l-2.3-.8-2 3.4 2 1.4a7.4 7.4 0 0 0 0 3l-2 1.4 2 3.4 2.3-.8a7.3 7.3 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.3 7.3 0 0 0 2.6-1.5l2.3.8 2-3.4-2-1.4Z" />
  </Icon>
);
const IconDevices = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2.5" y="5" width="14" height="10" rx="1.5" />
    <path d="M6 18h6" />
    <rect x="17.5" y="8" width="5" height="10" rx="1" />
  </Icon>
);
const IconWhatsapp = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M7 17.5 3.5 18.5 4.6 15A8 8 0 1 1 7 17.5Z" />
    <path d="M9 10c0 2.8 2.2 5 5 5 .3-1 .3-1.7 0-2l-1.8-.8-.9 1a5 5 0 0 1-2.5-2.5l1-.9-.8-1.8c-.3-.3-1-.3-2 0Z" />
  </Icon>
);
const IconRemote = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16v4" />
    <path d="m9.5 8 2 2-2 2M14.5 12h-1.8" />
  </Icon>
);
const IconVideo = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2.5" y="6" width="13" height="12" rx="1.5" />
    <path d="m15.5 10.5 5.5-3v9l-5.5-3Z" />
  </Icon>
);
const IconChevronDown = (props: SVGProps<SVGSVGElement>) => (
  <Icon strokeWidth={2.25} {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-border py-4 first:pt-0 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink marker:content-none">
        {question}
        <IconChevronDown className="h-4 w-4 shrink-0 text-ink-soft transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <p className="mt-3 text-sm text-ink-soft">{answer}</p>
    </details>
  );
}

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
    title: "7 dias grátis, sem cartão",
    description: "Organizamos seu cardápio e sua configuração em até 10 dias úteis — só depois disso, com tudo pronto, o teste grátis de 7 dias começa a contar.",
  },
];

const COMPARISON = [
  { label: "Comissão por pedido", us: "R$ 0 — mensalidade fixa", them: "Até 30% por venda" },
  { label: "Marca exibida pro cliente", us: "A sua", them: "A do aplicativo" },
  { label: "Dados de contato do seu cliente", us: "Seus, pra sempre", them: "Do aplicativo" },
  { label: "Personalização do cardápio/visual", us: "Total", them: "Quase nenhuma" },
];

const ROTINA: { title: string; image: string; description: string }[] = [
  {
    title: "Pense no crescimento, não na correria",
    image: "/assets/hero/rotina-crescimento-v2.jpg",
    description: "Troque hora apagando incêndio por hora pensando em cardápio novo, horário de pico e como girar mais nos dias fracos.",
  },
  {
    title: "Menos trabalho repetitivo",
    image: "/assets/hero/rotina-menos-trabalho-v2.jpg",
    description: "O pedido entra sozinho, já com o valor certo. Ninguém mais precisa copiar comanda à mão nem discutir troco no balcão.",
  },
  {
    title: "Tudo numa tela só",
    image: "/assets/hero/rotina-tudo-tela-v2.jpg",
    description: "Cardápio, mesa, entrega e relatório do mês reunidos no mesmo lugar — chega de abrir três sistemas diferentes pra fechar o caixa.",
  },
];

const MODULOS: { title: string; description: string; badge?: string }[] = [
  { title: "Cardápio digital", description: "Mantém prato, foto e preço sempre em dia, sem depender de ninguém pra atualizar." },
  { title: "Pedidos e entregas", description: "Cada pedido chega pronto pra produção, sem intermediário levando fatia da venda." },
  { title: "Pagamentos", description: "Pix ou cartão: o Mercado Pago processa tudo e repassa pro seu bolso, sem você mexer em nada." },
  {
    title: "Mesas e QR Code",
    badge: "Profissional e Premium",
    description: "O cliente chama o garçom, pede rodada extra e fecha a conta pelo celular, sem levantar da mesa.",
  },
  {
    title: "Promoções e eventos",
    badge: "Profissional e Premium",
    description: "Monta combos e datas especiais pra girar o movimento nos dias mais fracos da semana.",
  },
  {
    title: "Nota fiscal (NFC-e)",
    description: "Emissão fiscal integrada ao sistema, disponível em todos os planos — dispensa um programa à parte só pra essa parte.",
  },
];

const RESUMO: { icon: (props: SVGProps<SVGSVGElement>) => ReactNode; title: string; description: string }[] = [
  {
    icon: IconCoin,
    title: "Sem limite de faturamento",
    description: "A mensalidade é fixa — não importa quanto seu restaurante venda, não tem cobrança extra por cima do seu faturamento.",
  },
  {
    icon: IconGear,
    title: "Sem comissão no delivery",
    description: "Receba os pedidos direto no seu próprio sistema, sem pagar taxa por venda como nos aplicativos de entrega.",
  },
  {
    icon: IconDevices,
    title: "Limites claros, sem pegadinha",
    description: "Cada plano já vem com o número de usuários definido, sem letra miúda: Entrada até 3, Profissional até 8, Premium sem limite de usuários.",
  },
];

const SUPORTE: { icon: (props: SVGProps<SVGSVGElement>) => ReactNode; title: string; description: string }[] = [
  {
    icon: IconWhatsapp,
    title: "WhatsApp direto comigo",
    description: "Resposta rápida, sem robô e sem fila de espera.",
  },
  {
    icon: IconRemote,
    title: "Acesso remoto",
    description: "Se travar, eu entro no seu painel pra resolver junto com você — sem pedir sua senha.",
  },
  {
    icon: IconVideo,
    title: "Treinamento ao vivo",
    description: "Chamada de vídeo ensinando a usar o sistema, junto com a entrega do seu restaurante.",
  },
];

const STEPS = [
  { number: "1", title: "Escolha o plano", description: "Compare os recursos e escolha o que faz sentido pro tamanho do seu restaurante." },
  { number: "2", title: "Cadastre seu restaurante", description: "Leva menos de 2 minutos — sem cartão de crédito, sem burocracia." },
  {
    number: "3",
    title: "Comece a vender",
    description: "Nossa equipe organiza seu cardápio e sua configuração em até 10 dias úteis. Pronto, seu teste grátis de 7 dias começa a valer.",
  },
];

// Todas as respostas reaproveitam texto já existente noutras seções desta
// mesma página / em Termos.tsx / Planos.tsx — nada novo sendo prometido aqui.
const FAQ = [
  {
    question: "Preciso saber mexer em sistema?",
    answer: "Não. Nossa equipe organiza seu cardápio e sua configuração inicial, e você ainda tem WhatsApp direto com quem construiu o sistema, acesso remoto pra resolver travas (sem pedir sua senha) e treinamento ao vivo por chamada de vídeo.",
  },
  {
    question: "Como funciona o teste grátis de 7 dias?",
    answer: "Assim que sua configuração estiver pronta (em até 10 dias úteis), o teste de 7 dias começa a valer — sem cartão de crédito.",
  },
  {
    question: "Posso cancelar ou trocar de plano quando quiser?",
    answer: "Sim, direto no seu painel, sem multa e sem fidelidade.",
  },
  {
    question: "Meus dados ficam seguros?",
    answer: "Cada restaurante roda num deployment isolado — seus dados de cardápio, pedidos e clientes nunca ficam misturados com os de outro restaurante. Conexão sempre criptografada, senhas nunca guardadas em texto puro.",
  },
  {
    question: "Como funciona o pagamento?",
    answer: "Pix e cartão, processados com segurança pelo Mercado Pago. Nunca pedimos dados de cartão diretamente.",
  },
  {
    question: "O que é a taxa de implementação?",
    answer: "Cobre a configuração completa: subir seus produtos no sistema, testar tudo até funcionar 100% e entregar pronto pra vender. Cobrada uma única vez, no cadastro.",
  },
];

export default function Home() {
  usePageMeta({ ...COMMERCIAL_PAGE_META["/comercial"], path: "/comercial" });
  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      <ComercialHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] opacity-70"
          // var(--accent)/var(--paper) raw, não os aliases --color-* do @theme inline: o
          // alias não acompanha a sobrescrita de .comercial-dark quando usado dentro de um
          // inline style (achado real corrigindo o card "Mais escolhido" de Planos.tsx,
          // 2026-09-24) — a variável raw não tem esse problema.
          style={{ background: "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent)" }}
        />
        <div className="relative w-full">
          <img
            src="/assets/hero/hero-banner.jpg"
            alt="Painel do MM System Creator em uso: vendas, pedidos e financeiro do restaurante em tempo real"
            className="h-auto w-full"
          />
          <a
            href="#diferenciais"
            aria-label="Conheça o sistema"
            className="absolute"
            style={{ left: "3%", top: "63%", width: "24%", height: "12%" }}
          />
        </div>
        <div
          className="h-20 w-full sm:h-28"
          style={{
            background: "linear-gradient(to bottom, #00081a 0%, #1e1b6e 40%, var(--accent) 70%, var(--paper) 100%)",
          }}
        />

        <div className="mx-auto max-w-5xl px-6 pb-24 pt-10 text-center">
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
              <IconCheck className="h-4 w-4 text-emerald-400" /> 7 dias grátis
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-400" /> Sem cartão de crédito
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck className="h-4 w-4 text-emerald-400" /> Cancele quando quiser
            </span>
          </p>
        </div>
      </section>

      {/* Calculadora de economia */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Quanto você deixa de pagar em comissão?</h2>
          <p className="mt-3 text-ink-soft">Arraste pro faturamento mensal do seu restaurante e veja a diferença.</p>
        </Reveal>
        <Reveal className="mt-10" delayMs={100}>
          <SavingsCalculator />
        </Reveal>
      </section>

      {/* Rotina */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Seu tempo vale mais que planilha e comanda de papel</h2>
          <p className="mt-3 text-ink-soft">Você cuida do restaurante. O sistema cuida da correria.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {ROTINA.map((item, index) => (
            <Reveal key={item.title} delayMs={index * 100} className="group">
              <div className="aspect-[3/2] overflow-hidden rounded-2xl border border-border shadow-lg transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              </div>
              <p className="mt-4 text-base text-ink-soft">{item.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Resumo rápido */}
      <section className="border-y border-border bg-paper-raised/60">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-ink sm:text-3xl">Por que escolher o MM System Creator?</h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {RESUMO.map((item, index) => (
              <Reveal key={item.title} delayMs={index * 100} className="group text-center">
                <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <item.icon className="h-8 w-8" />
                </div>
                <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">{item.description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Por que trocar o app de entrega pelo seu próprio sistema</h2>
          <p className="mt-3 text-ink-soft">O que faz diferença de verdade no fim do mês.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {DIFERENCIAIS.map((item, index) => (
            <Reveal key={item.title} delayMs={(index % 3) * 100} className="group rounded-2xl border border-border bg-paper-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-transform duration-300 group-hover:scale-110">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparação */}
      <section className="border-y border-border bg-paper-raised/60">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">Sistema próprio x aplicativo de entrega</h2>
            <p className="mt-3 text-ink-soft">Nada contra os apps — só que quem carrega o restaurante no ombro é você.</p>
          </Reveal>
          <Reveal delayMs={150} className="mt-10 overflow-hidden rounded-2xl border border-border bg-paper-raised">
            <div className="grid grid-cols-3 border-b border-border bg-paper text-sm font-semibold text-ink">
              <div className="px-4 py-3">&nbsp;</div>
              <div className="px-4 py-3 text-accent">Com sistema próprio</div>
              <div className="px-4 py-3 text-ink-soft">App de entrega comum</div>
            </div>
            {COMPARISON.map(row => (
              <div key={row.label} className="grid grid-cols-3 border-b border-border text-sm transition-colors last:border-b-0 hover:bg-accent/5">
                <div className="px-4 py-4 font-medium text-ink">{row.label}</div>
                <div className="flex items-center gap-2 px-4 py-4 text-ink">
                  <IconCheck className="h-4 w-4 shrink-0 text-emerald-400" /> {row.us}
                </div>
                <div className="flex items-center gap-2 px-4 py-4 text-ink-soft">
                  <IconX className="h-4 w-4 shrink-0 text-red-400" /> {row.them}
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Módulos */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Um sistema completo, sem juntar outros por fora</h2>
          <p className="mt-3 text-ink-soft">Seis frentes cobertas dentro do mesmo painel — cresce junto com o plano escolhido.</p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((item, index) => (
            <Reveal key={item.title} delayMs={(index % 3) * 100} className="rounded-2xl border border-border bg-paper-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink">{item.title}</h3>
                {item.badge && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">{item.badge}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/comercial/planos" className={PRIMARY_LINK_CLASSES}>
            Ver planos e recursos completos
          </Link>
        </div>
      </section>

      {/* Como funciona */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Como funciona</h2>
        </Reveal>
        <div className="relative mt-12 grid gap-8 sm:grid-cols-3">
          <div aria-hidden="true" className="absolute top-[18px] left-0 right-0 hidden h-px bg-border sm:block" />
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delayMs={index * 150} className="relative text-center sm:text-left">
              <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white ring-4 ring-paper">
                {step.number}
              </span>
              <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{step.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Suporte */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Suporte que não deixa você na mão</h2>
          <p className="mt-3 text-ink-soft">Sem central de atendimento genérica — você fala direto com quem construiu o sistema.</p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {SUPORTE.map((item, index) => (
            <Reveal key={item.title} delayMs={index * 100} className="group rounded-2xl border border-border bg-paper-raised p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-transform duration-300 group-hover:scale-110">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{item.description}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sobre o criador */}
      <section className="border-y border-border bg-paper-raised/60">
        <Reveal className="mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">Quem criou</span>
          <div className="mt-4 flex items-center justify-center">
            <img src="/mm-logo-icon.png" alt="" aria-hidden="true" className="h-16 w-16 rounded-2xl shadow-sm" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-ink sm:text-3xl">Maycon Meneses</h2>
          <p className="mt-4 text-ink-soft">
            O MM System Creator é um projeto <strong className="text-ink">100% autoral</strong> — idealizado,
            projetado e construído do zero por Maycon Meneses, sem plataforma no-code por trás e sem
            terceirização. Da ideia ao código, cada parte do sistema foi pensada pra resolver o problema de
            verdade de quem administra um restaurante.
          </p>
          <p className="mt-4 text-sm font-semibold tracking-wide text-accent">Ideias · Sistemas · Soluções</p>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <Reveal className="text-center">
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">Perguntas frequentes</h2>
        </Reveal>
        <Reveal delayMs={100} className="mt-10 rounded-2xl border border-border bg-paper-raised px-6">
          {FAQ.map(item => (
            <FaqItem key={item.question} {...item} />
          ))}
        </Reveal>
      </section>

      {/* CTA final */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <Reveal
          className="rounded-2xl px-8 py-14 text-center text-white shadow-xl shadow-[#6146fd]/10"
          style={{ background: "linear-gradient(135deg, #008cfe, #6146fd)" }}
        >
          <h2 className="text-2xl font-bold sm:text-3xl">Pronto pra vender sem depender de aplicativo de terceiro?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/85">7 dias grátis assim que seu sistema estiver pronto — sem cartão de crédito. Cancele quando quiser.</p>
          <div className="mt-8">
            <Link
              href="/comercial/planos"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-8 text-sm font-semibold text-accent shadow-sm transition-colors hover:bg-white/90"
            >
              Ver planos e começar agora
            </Link>
          </div>
        </Reveal>
      </section>

      <ComercialFooter />
    </div>
  );
}
