import { motion, useReducedMotion } from "motion/react";
import { useLocation } from "wouter";
import { HERO } from "../content";
import { track } from "../lib/track";
import { CutReveal } from "./CutReveal";
import { MagneticLink } from "./MagneticLink";
import { asset } from "../lib/asset";
import { scrollToHashWhenReady } from "../lib/scroll";
import { RestaurantPreview } from "./hero/RestaurantPreview";
import { TrustSeals } from "./hero/TrustSeals";

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Hero({ ready }: { ready: boolean }) {
  const reduce = useReducedMotion();
  const [, navigate] = useLocation();
  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: ready || reduce ? { opacity: 1, y: 0 } : undefined,
    transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <section className="relative overflow-hidden bg-bg-alt" aria-labelledby="hero-title">
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1.3fr_1fr] lg:gap-16 lg:pb-16">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-block self-start rounded-full bg-seal px-3 py-[0.22rem] text-[0.8rem] font-bold tracking-[0.02em] text-white">{HERO.badge}</p>
          <h1 id="hero-title" className="text-[clamp(2.4rem,5.2vw,4.25rem)] font-bold leading-[1] tracking-[-0.025em]">
            {HERO.titleLines.map((line, i) => (
              <CutReveal key={line} text={line} play={ready} delay={0.1 + i * 0.15} className="block" highlight={line === HERO.titleKeyword[0] ? HERO.titleKeyword[1] : undefined} />
            ))}
            <CutReveal
              text={HERO.titleMuted}
              play={ready}
              delay={0.45}
              className="mt-3 block text-[0.42em] font-medium leading-[1.15] tracking-normal text-ink-soft"
            />
          </h1>

          {/* Sem animação de entrada de propósito: é o maior texto da 1ª dobra (elemento do LCP). */}
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">{HERO.lead}</p>

          <motion.div {...fadeUp(0.8)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticLink
              href={asset("/planos")}
              onClick={e => {
                e.preventDefault();
                track("cta_click");
                navigate("/planos");
              }}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {HERO.primaryCta}
              <IconArrow />
            </MagneticLink>
            <a
              href="#por-dentro"
              onClick={e => {
                e.preventDefault();
                scrollToHashWhenReady("#por-dentro");
              }}
              className="inline-flex h-13 items-center justify-center rounded-xl border-[1.5px] border-ink px-7 text-base font-semibold text-ink transition-colors hover:bg-accent/10"
            >
              {HERO.secondaryCta}
            </a>
          </motion.div>

          <motion.div {...fadeUp(0.9)}>
            <TrustSeals />
          </motion.div>
        </div>

        <motion.div {...fadeUp(0.55)} className="mx-auto w-full max-w-sm self-center lg:mx-0 lg:max-w-none">
          <RestaurantPreview />
        </motion.div>
      </div>
    </section>
  );
}

