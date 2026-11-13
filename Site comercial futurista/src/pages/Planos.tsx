import { useState } from "react";
import { motion } from "motion/react";
import { PlanFinder } from "../components/plans/PlanFinder";
import { recommend, type FinderAnswers } from "../data/planFinder";
import { PlanCards } from "../components/plans/PlanCards";
import { CompareTable } from "../components/plans/CompareTable";
import { PLANS, type Plan } from "../data/plans";
import { usePlans } from "../lib/usePlans";
import { publicUrl, usePageMeta } from "../lib/seo";

// SoftwareApplication, não Product: o Comandiva é uma assinatura de software, e o tipo Product faz o Google
// validar a página como "listagem do comerciante" (exige imagem, frete e devolução) e marcar um item inválido.
const planosLd = (plans: Plan[]) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Comandiva",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Sistema para restaurante com cardápio digital, pedidos online, entregas e pagamento por Pix e cartão, sem comissão por pedido. Veja os planos e teste grátis.",
  offers: plans.map(plan => ({
    "@type": "Offer",
    name: plan.name,
    price: (plan.priceCents / 100).toFixed(2),
    priceCurrency: "BRL",
    url: publicUrl("/planos"),
  })),
});

const EASE = [0.32, 0.72, 0, 1] as const;
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: "some" as const },
  transition: { duration: 0.8, ease: EASE },
};

export default function Planos() {
  const [answers, setAnswers] = useState<FinderAnswers>({ tables: true, team: "medium", advanced: false });
  const recommended = recommend(answers);
  const { plans, groups } = usePlans();
  const recName = (plans.find(p => p.key === recommended) ?? PLANS.find(p => p.key === recommended)!).name;
  usePageMeta("/planos", { jsonLd: planosLd(plans) });


  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 md:pt-20">
      <motion.header {...reveal} className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-medium text-accent-text">Planos</p>
        <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-balance">
          Escolha o plano do seu restaurante
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-ink-soft">
          7 dias de teste grátis assim que seu sistema estiver pronto (em até 10 dias úteis), sem cartão de crédito. Sem comissão por
          pedido: a mensalidade cobre o sistema e a hospedagem, ponto final.
        </p>
        <p className="mx-auto mt-4 w-fit rounded-full border border-warm/40 bg-tint px-4 py-1.5 text-sm text-warm-ink">
          Lançamento: 20% de desconto na mensalidade nos 2 primeiros meses
        </p>
      </motion.header>

      <motion.section {...reveal} className="mt-16" aria-labelledby="finder-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <h2 id="finder-title" className="font-display text-2xl font-semibold">
            Descubra seu plano em 3 respostas
          </h2>
          <p className="text-sm text-ink-soft" aria-live="polite">
            Indicado agora: <strong className="text-ink">{recName}</strong>
          </p>
        </div>
        <PlanFinder answers={answers} onChange={setAnswers} />
      </motion.section>
      </div>

      <div className="bg-band text-band-ink">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-24">
          <section aria-label="Planos">
            <PlanCards plans={plans} groups={groups} recommended={recommended} />
            <p className="mt-8 text-center text-sm text-band-soft">
              Pode trocar de plano quando quiser, direto no seu painel, sem multa. Pagamento pelo Mercado Pago.
            </p>
          </section>

          <motion.section {...reveal} className="mt-24" aria-labelledby="compare-title">
            <h2 id="compare-title" className="text-center font-display text-[clamp(1.8rem,3.5vw,2.75rem)] font-semibold tracking-[-0.02em] text-band-ink">
              Compare tudo, lado a lado
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-band-soft">
              Todo plano mostra o sistema inteiro; o que muda é o que já vem liberado.
            </p>
            <div className="mt-10">
              <CompareTable plans={plans} groups={groups} recommended={recommended} />
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
