import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

/**
 * Assinatura que se escreve sozinha: o traço percorre o contorno das letras
 * e depois a tinta preenche. Referência visual: Animated Signature, da
 * coleção Kitchen (dqnamo.com) — reescrito com fonte manuscrita livre (OFL).
 * Espera a fonte carregar antes de desenhar, para não animar a fonte errada.
 */
export function Signature({ name, className = "" }: { name: string; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let alive = true;
    document.fonts
      .load('72px "Signature"', name)
      .then(() => alive && setFontReady(true))
      .catch(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, [name]);

  const play = inView && fontReady;

  return (
    <svg ref={ref} viewBox="0 0 440 110" role="img" aria-label={`Assinatura de ${name}`} className={className}>
      <motion.text
        x="8"
        y="78"
        fontFamily="Signature"
        fontSize="78"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="1400"
        initial={{ strokeDashoffset: 1400, fillOpacity: 0 }}
        animate={play ? { strokeDashoffset: 0, fillOpacity: 1 } : undefined}
        transition={{
          strokeDashoffset: { duration: 2.4, ease: [0.45, 0.05, 0.25, 1] },
          fillOpacity: { duration: 0.6, delay: 1.9, ease: "easeOut" },
        }}
      >
        {name}
      </motion.text>
    </svg>
  );
}
