import { motion, useReducedMotion } from "motion/react";
import { useLocation } from "wouter";
import { HERO } from "../content";
import { track } from "../lib/track";
import { CutReveal } from "./CutReveal";
import { LiveTickets } from "./LiveTickets";
import { MagneticLink } from "./MagneticLink";

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent-text" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
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
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:pb-28">
        <div className="flex flex-col justify-center">
          <motion.p {...fadeUp(0)} className="font-mono text-xs uppercase tracking-[0.2em] text-accent-text">
            {HERO.eyebrow}
          </motion.p>

          <h1 id="hero-title" className="mt-5 font-display text-[clamp(2.4rem,5.4vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.02em]">
            {HERO.titleLines.map((line, i) => (
              <CutReveal key={line} text={line} play={ready} delay={0.1 + i * 0.15} className="block" />
            ))}
            <CutReveal
              text={HERO.titleMuted}
              play={ready}
              delay={0.45}
              className="mt-3 block text-[0.42em] font-medium leading-[1.1] tracking-normal text-ink-soft"
            />
          </h1>

          {/* Sem animação de entrada de propósito: é o maior texto da 1ª dobra (elemento do LCP). */}
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-soft">{HERO.lead}</p>

          <motion.div {...fadeUp(0.8)} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticLink
              href="/planos"
              onClick={e => {
                e.preventDefault();
                track("cta_click");
                navigate("/planos");
              }}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-accent-strong px-7 transition-colors hover:bg-[#0076e0] text-base font-semibold text-white"
            >
              {HERO.primaryCta}
              <span aria-hidden="true">→</span>
            </MagneticLink>
            <a
              href="#por-dentro"
              className="inline-flex h-13 items-center justify-center rounded-xl border border-line px-7 text-base font-semibold text-ink transition-colors hover:bg-bg-raised"
            >
              {HERO.secondaryCta}
            </a>
          </motion.div>

          <motion.ul {...fadeUp(0.9)} className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
            {HERO.checks.map(check => (
              <li key={check} className="inline-flex items-center gap-1.5">
                <IconCheck />
                {check}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div {...fadeUp(0.55)} className="lg:pt-6">
          <LiveTickets play={ready} />
        </motion.div>
      </div>
    </section>
  );
}
