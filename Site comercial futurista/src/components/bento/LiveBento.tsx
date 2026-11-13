import { useRef, type ComponentType } from "react";
import { motion, useInView } from "motion/react";
import { DIFERENCIAIS, type DiferencialKey } from "../../data/home";
import { SectionHeading } from "../ui/SectionHeading";
import { Marked } from "../ui/Kw";
import { reveal } from "../../lib/motion";
import { DemoComissao, DemoGratis, DemoInternet, DemoMarca, DemoPagamento, DemoTestado } from "./demos";

const DEMOS: Record<DiferencialKey, ComponentType<{ play: boolean }>> = {
  comissao: DemoComissao,
  marca: DemoMarca,
  testado: DemoTestado,
  internet: DemoInternet,
  pagamento: DemoPagamento,
  gratis: DemoGratis,
};

/** Bento assimétrico: os dois primeiros cartões são largos (lg). */
const SPANS = ["lg:col-span-4", "lg:col-span-2", "lg:col-span-2", "lg:col-span-4", "lg:col-span-3", "lg:col-span-3"];

function Card({ index }: { index: number }) {
  const item = DIFERENCIAIS[index];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: "some" });
  const Demo = DEMOS[item.key];
  // O cartão de comissão zero é o destaque do bento: fundo mostarda
  const strong = item.key === "comissao";
  return (
    <motion.div {...reveal((index % 3) * 0.08)} className={SPANS[index]}>
      <div
        ref={ref}
        className="card-lift group relative h-full rounded-2xl border border-line bg-bg-raised"
      >
        <div className={"flex h-full flex-col justify-between gap-6 rounded-2xl p-6 sm:p-7 " + (strong ? "bg-mark" : "bg-bg-raised")}>
          <Demo play={inView} />
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{item.title}</h3>
            <p className={"mt-2 text-sm leading-relaxed " + (strong ? "text-mark-ink" : "text-ink-soft")}>{item.description}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * "Por que trocar o app de entrega pelo seu próprio sistema": cada
 * diferencial vem com uma mini demonstração viva do que ele faz.
 */
export function LiveBento() {
  return (
    <section id="diferenciais" className="px-4 py-28 sm:px-6" aria-labelledby="dif-title">
      <SectionHeading
        id="dif-title"
        eyebrow="Diferenciais"
        title={<Marked text="Por que trocar o app de entrega pelo seu próprio sistema" phrase="seu próprio sistema" />}
        lead="O que faz diferença de verdade no fim do mês, funcionando aqui embaixo."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-6">
        {DIFERENCIAIS.map((_, i) => (
          <Card key={DIFERENCIAIS[i].key} index={i} />
        ))}
      </div>
    </section>
  );
}
