import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { STEPS } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";

/**
 * "Como funciona" com a linha desenhada pela rolagem (referência: Scroll
 * animated timeline, 21st.dev). Horizontal no computador, vertical no celular.
 */
export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const grow = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="como-title">
      <SectionHeading id="como-title" eyebrow="Como funciona" title="Do cadastro à primeira venda em 3 passos" />

      <ol ref={ref} className="relative mx-auto mt-16 grid max-w-5xl gap-10 md:grid-cols-3 md:gap-8">
        <span aria-hidden="true" className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px bg-line md:left-0 md:top-[19px] md:h-px md:w-full" />
        <motion.span
          aria-hidden="true"
          style={{ scaleY: grow }}
          className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px origin-top bg-accent md:hidden"
        />
        <motion.span aria-hidden="true" style={{ scaleX: grow }} className="absolute left-0 top-[19px] hidden h-px w-full origin-left bg-accent md:block" />

        {STEPS.map((step, i) => (
          <motion.li key={step.title} {...reveal(i * 0.12)} className="relative pl-14 md:pl-0">
            <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-full border border-accent bg-bg font-mono text-sm text-accent-text md:relative">
              {i + 1}
            </span>
            <h3 className="font-display text-xl font-semibold md:mt-6">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.description}</p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
