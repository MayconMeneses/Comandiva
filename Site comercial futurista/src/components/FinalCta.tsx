import { useLocation } from "wouter";
import { CutReveal } from "./CutReveal";
import { MagneticLink } from "./MagneticLink";
import { useInView } from "motion/react";
import { useRef } from "react";
import { track } from "../lib/track";
import { asset } from "../lib/asset";

/**
 * Fechamento: frase gigante revelada palavra a palavra e botão magnético
 * com ícone encaixado. A palavra-marca "Comandiva" ao fundo, vazada, é
 * decorativa (referência: Giant Wordmark Footer, 21st.dev).
 */
export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [, navigate] = useLocation();

  return (
    <section ref={ref} className="relative overflow-hidden px-4 pb-24 pt-32 sm:px-6" aria-labelledby="cta-title">
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[-0.18em] select-none text-center font-display text-[22vw] font-semibold leading-none tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_var(--line)]"
      >
        Comandiva
      </p>
      <div className="relative mx-auto max-w-5xl text-center">
        <h2 id="cta-title" className="font-display text-[clamp(2.4rem,7vw,6rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
          <CutReveal text="Pronto pra vender" play={inView} className="block" />
          <CutReveal text="sem depender de app?" play={inView} delay={0.15} className="block text-ink-soft" />
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-ink-soft">7 dias grátis assim que seu sistema estiver pronto — sem cartão de crédito. Cancele quando quiser.</p>
        <div className="mt-10 flex justify-center">
          <MagneticLink
            href={asset("/planos")}
            onClick={e => {
              e.preventDefault();
              track("cta_click");
              navigate("/planos");
            }}
            className="group inline-flex items-center gap-4 rounded-full bg-ink py-2 pl-7 pr-2 text-base font-semibold text-bg"
          >
            Ver planos e começar agora
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-full bg-bg text-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5"
            >
              ↗
            </span>
          </MagneticLink>
        </div>
      </div>
    </section>
  );
}
