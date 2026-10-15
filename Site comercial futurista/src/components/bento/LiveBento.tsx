import { useRef, type ComponentType } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { DIFERENCIAIS, type DiferencialKey } from "../../data/home";
import { SectionHeading } from "../ui/SectionHeading";
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
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const Demo = DEMOS[item.key];

  // Spotlight discreto que segue o cursor (referência: Spotlight Card, 21st.dev) — só borda, sem glow.
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <motion.div {...reveal((index % 3) * 0.08)} className={SPANS[index]}>
      <div
        ref={ref}
        onPointerMove={onMove}
        className="group relative h-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5 [background-image:radial-gradient(240px_circle_at_var(--mx,50%)_var(--my,50%),rgba(77,176,255,.14),transparent_70%)]"
      >
        <div className="flex h-full flex-col justify-between gap-6 rounded-[calc(2rem-0.375rem)] bg-bg-raised p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,.06)] sm:p-7">
          <Demo play={inView && !reduce} />
          <div>
            <h3 className="font-display text-xl font-semibold leading-tight">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.description}</p>
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
        title="Por que trocar o app de entrega pelo seu próprio sistema"
        lead="O que faz diferença de verdade no fim do mês — funcionando aqui embaixo."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-6">
        {DIFERENCIAIS.map((_, i) => (
          <Card key={DIFERENCIAIS[i].key} index={i} />
        ))}
      </div>
    </section>
  );
}
