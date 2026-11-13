import { useLocation } from "wouter";
import { CutReveal } from "./CutReveal";
import { MagneticLink } from "./MagneticLink";
import { useInView } from "motion/react";
import { useRef } from "react";
import { track } from "../lib/track";
import { asset } from "../lib/asset";
import { ArrowIcon } from "./ui/Icons";

/**
 * Fechamento em faixa escura: frase gigante revelada palavra a palavra e botão
 * azul magnético. A palavra-marca "Comandiva" ao fundo, vazada, é
 * decorativa (referência: Giant Wordmark Footer, 21st.dev).
 */
export function FinalCta() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: "some" });
  const [, navigate] = useLocation();

  return (
    <section ref={ref} className="relative overflow-hidden bg-band px-4 pb-28 pt-28 text-band-ink sm:px-6 sm:pt-32" aria-labelledby="cta-title">
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[-0.18em] select-none text-center font-display text-[22vw] font-semibold leading-none tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.14)]"
      >
        Comandiva
      </p>
      <div className="relative mx-auto max-w-5xl text-center">
        <h2 id="cta-title" className="font-display text-[clamp(2.4rem,7vw,6rem)] font-semibold leading-[0.95] tracking-[-0.03em]">
          <CutReveal text="Pronto pra vender" play={inView} className="block" highlight="vender" highlightClass="kw-band" />
          <CutReveal text="sem depender de app?" play={inView} delay={0.15} className="block" />
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-band-soft">7 dias grátis assim que seu sistema estiver pronto, sem cartão de crédito. Cancele quando quiser.</p>
        <div className="mt-10 flex justify-center">
          <MagneticLink
            href={asset("/planos")}
            onClick={e => {
              e.preventDefault();
              track("cta_click");
              navigate("/planos");
            }}
            className="group inline-flex min-h-14 items-center gap-4 rounded-full bg-accent py-2 pl-7 pr-2 text-base font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-accent-hover active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Ver planos e começar agora
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-accent">
              <ArrowIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </span>
          </MagneticLink>
        </div>
      </div>
    </section>
  );
}
