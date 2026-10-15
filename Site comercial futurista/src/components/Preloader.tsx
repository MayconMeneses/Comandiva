import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const SEEN_KEY = "comandiva-preloader-visto";

const LINES = [
  { left: "PEDIDO", right: "Nº 0001" },
  { left: "MESA / ENTREGA", right: "OK" },
  { left: "COMISSÃO", right: "R$ 0,00" },
];

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Comanda "imprimindo" na entrada do site. Aparece uma vez por sessão e
 * nunca para quem pede menos movimento — nesses casos o site abre direto.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(() => !alreadySeen());

  useEffect(() => {
    if (!visible || reduce) {
      setVisible(false);
      onDone();
      return;
    }
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* navegação privada: só mostra de novo na próxima visita */
    }
    // Curto de propósito: o hero só aparece depois dele, então cada 100 ms pesa no LCP.
    // O hero já começa a animar enquanto a cortina sobe.
    const t = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatePresence>
      {visible && !reduce && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 z-[70] grid place-items-center bg-bg"
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div
            className="ticket-edge w-[min(18rem,80vw)] bg-ticket px-5 pb-7 pt-5 font-mono text-[11px] uppercase tracking-wider text-ticket-ink"
            initial={{ clipPath: "inset(0 0 100% 0)", y: -24 }}
            animate={{ clipPath: "inset(0 0 0% 0)", y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-dashed border-ticket-soft/50 pb-3">
              <span className="font-display text-base font-semibold normal-case tracking-tight">Comandiva</span>
              <span className="text-ticket-soft">18:00</span>
            </div>
            {LINES.map((line, i) => (
              <motion.div
                key={line.left}
                className="flex justify-between pt-2.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.15 }}
              >
                <span className="text-ticket-soft">{line.left}</span>
                <span>{line.right}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
