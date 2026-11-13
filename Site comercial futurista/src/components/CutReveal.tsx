import { motion, useReducedMotion } from "motion/react";

/**
 * Texto que entra palavra a palavra subindo de trás de uma máscara
 * (referência: "Vertical Cut Reveal", 21st.dev). O texto completo fica
 * acessível; as palavras animadas são só visuais.
 */
export function CutReveal({
  text,
  play,
  delay = 0,
  className,
  highlight,
  highlightClass = "kw",
}: {
  text: string;
  play: boolean;
  delay?: number;
  className?: string;
  /** Trecho do texto destacado só pela cor (classe em index.css). */
  highlight?: string;
  highlightClass?: string;
}) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const at = highlight ? text.indexOf(highlight) : -1;
  const from = at < 0 ? -1 : text.slice(0, at).split(" ").length - 1;
  const to = at < 0 ? -1 : from + (highlight as string).split(" ").length - 1;

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className={i >= from && i <= to ? "inline-block " + highlightClass : "inline-block"}
              initial={reduce ? false : { y: "110%" }}
              animate={play || reduce ? { y: 0 } : undefined}
              transition={{ delay: delay + i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </span>
    </span>
  );
}
