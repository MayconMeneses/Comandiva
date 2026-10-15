import { useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";

/**
 * Impressora de comanda: um aparelho com fenda de onde o papel sai em
 * "passos", como uma térmica de verdade. Referência visual: Receipt Printer,
 * da coleção Kitchen (dqnamo.com) — reescrito do zero no visual da marca.
 *
 * - Imprime quando entra na tela.
 * - Troque `printKey` para imprimir de novo (ex.: valor novo confirmado).
 * - `onPrinted` avisa quando o papel terminou de sair (ex.: para carimbar).
 * - Com movimento reduzido (MotionConfig "user"), o papel aparece direto.
 */
export function ReceiptPrinter({
  printKey,
  label = "Comandiva",
  children,
  onPrinted,
}: {
  printKey: number | string;
  label?: string;
  children: ReactNode;
  onPrinted?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [busyKey, setBusyKey] = useState<number | string | null>(null);
  const busy = inView && busyKey !== printKey;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-sm">
      {/* Corpo da impressora */}
      <div className="relative z-10 rounded-[1.75rem] border border-white/10 bg-gradient-to-b from-[#1b1e27] to-[#111319] p-4 pb-5 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_30px_60px_-30px_rgba(0,0,0,.9)]">
        <div className="flex items-center justify-between px-1 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          <span className="flex items-center gap-2">
            <span data-busy={busy || undefined} className={`printer-led h-1.5 w-1.5 rounded-full ${busy ? "bg-[#4ade80]" : "bg-line"}`} aria-hidden="true" />
            {label}
          </span>
          <span aria-live="polite">{busy ? "Imprimindo…" : inView ? "Pronto" : "Aguardando"}</span>
        </div>
        {/* Fenda */}
        <div className="mt-4 h-2.5 rounded-full bg-black shadow-[inset_0_2px_4px_rgba(0,0,0,.9),0_1px_0_rgba(255,255,255,.06)]" aria-hidden="true" />
      </div>

      {/* Papel saindo da fenda */}
      <div className="relative z-0 mx-auto -mt-3 w-[90%] overflow-hidden pt-1">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-black/40 to-transparent" />
        <motion.div
          key={printKey}
          initial={{ y: "-100%" }}
          animate={inView ? { y: ["-100%", "-74%", "-72%", "-46%", "-44%", "-18%", "-16%", "0%"] } : undefined}
          transition={{ duration: 1.5, ease: "linear", times: [0, 0.18, 0.26, 0.44, 0.52, 0.7, 0.78, 1] }}
          onAnimationComplete={() => {
            setBusyKey(printKey);
            onPrinted?.();
          }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
