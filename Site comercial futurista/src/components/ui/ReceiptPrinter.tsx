import { useRef, useState, type ReactNode } from "react";
import { motion, useInView } from "motion/react";

/**
 * Impressora de comanda: um aparelho com fenda de onde o papel sai em
 * "passos", como uma térmica de verdade. Referência visual: Receipt Printer,
 * da coleção Kitchen (dqnamo.com), reescrito do zero no visual da marca.
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
      {/* Corpo da impressora: papel liso com borda, sem degradê nem sombra */}
      <div className="relative z-10 rounded-2xl border border-line bg-ticket p-4 pb-5">
        <div className="flex items-center justify-between px-1 text-xs text-ticket-soft">
          <span className="flex items-center gap-2">
            <span data-busy={busy || undefined} className={`printer-led h-1.5 w-1.5 rounded-full ${busy ? "bg-ok" : "bg-ticket-soft"}`} aria-hidden="true" />
            {label}
          </span>
          <span aria-live="polite">{busy ? "Imprimindo…" : inView ? "Pronto" : "Aguardando"}</span>
        </div>
        {/* Fenda */}
        <div className="mt-4 h-2.5 rounded-full bg-ticket-ink" aria-hidden="true" />
      </div>

      {/* Papel saindo da fenda */}
      <div className="relative z-0 mx-auto -mt-3 w-[90%] overflow-hidden pt-1">
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
