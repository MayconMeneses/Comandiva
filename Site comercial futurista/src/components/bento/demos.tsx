import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { EASE } from "../../lib/motion";

/**
 * Mini demonstrações dos cartões do bento. Cada uma recebe `play` (cartão
 * na tela e sem movimento reduzido) e só então anima, em ciclo.
 */
function useCycle(length: number, ms: number, play: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI(v => (v + 1) % length), ms);
    return () => clearInterval(t);
  }, [length, ms, play]);
  return i;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function DemoComissao({ play }: { play: boolean }) {
  const tick = useCycle(1000, 1400, play);
  const sold = [57, 60, 32, 40, 20].slice(0, (tick % 5) + 1).reduce((a, b) => a + b, 0) + Math.floor(tick / 5) * 209;
  return (
    <div className="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-wider">
      <div className="rounded-xl border border-line bg-bg p-3">
        <p className="text-ink-soft">Vendido</p>
        <p className="mt-1 text-base text-ink tabular-nums">{brl.format(sold)}</p>
      </div>
      <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
        <p className="text-accent-text">Comissão</p>
        <p className="mt-1 text-base text-ink tabular-nums">R$ 0,00</p>
      </div>
    </div>
  );
}

const NAMES = ["Pizzaria do Bairro", "Hamburgueria Central", "Sushi da Praça", "Seu restaurante"];

export function DemoMarca({ play }: { play: boolean }) {
  const i = useCycle(NAMES.length, 2200, play);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 font-mono text-[10px] text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-line" />
        <span className="truncate">cardápio.seurestaurante</span>
      </div>
      <div className="px-4 py-4">
        <div className="h-7 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={NAMES[i]}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="font-display text-lg font-semibold"
            >
              {NAMES[i]}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="mt-3 flex gap-2">
          {["Entradas", "Pratos", "Bebidas"].map(c => (
            <span key={c} className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft">
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const NET_STEPS = [
  { bars: 3, text: "Enviando pedido…", tone: "text-ink-soft" },
  { bars: 0, text: "Conexão caiu", tone: "text-[#ff8a8a]" },
  { bars: 1, text: "Tentando de novo sozinho…", tone: "text-ink-soft" },
  { bars: 3, text: "✓ Pedido enviado uma vez só", tone: "text-accent-text" },
];

export function DemoInternet({ play }: { play: boolean }) {
  const i = useCycle(NET_STEPS.length, 1500, play);
  const s = NET_STEPS[i];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-bg p-4">
      <div className="flex h-8 items-end gap-1" aria-hidden="true">
        {[1, 2, 3].map(b => (
          <motion.span
            key={b}
            className="w-1.5 rounded-sm bg-ink"
            initial={false}
            animate={{ opacity: s.bars >= b ? 1 : 0.18 }}
            style={{ height: `${b * 33}%` }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      <motion.p
        key={s.text}
        initial={{ opacity: 0.2, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className={`font-mono text-xs ${s.tone}`}
        aria-live="off"
      >
        {s.text}
      </motion.p>
    </div>
  );
}

/** QR estilizado (decorativo), não é um código Pix de verdade. */
const QR = "1110111010110101000100101111011010101110001010110111010110100101".split("");

export function DemoPagamento({ play }: { play: boolean }) {
  const paid = useCycle(2, 2000, play) === 1;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-bg p-4">
      <div className="relative grid h-16 w-16 shrink-0 grid-cols-8 gap-px rounded-md bg-white p-1.5" aria-hidden="true">
        {QR.map((c, k) => (
          <span key={k} className={c === "1" ? "bg-[#111]" : ""} />
        ))}
        <AnimatePresence>
          {paid && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="absolute inset-0 grid place-items-center rounded-md bg-ok text-2xl text-white"
            >
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="font-mono text-xs">
        <p className="text-ink-soft">Pix · Mercado Pago</p>
        <p className={`mt-1 text-sm ${paid ? "text-accent-text" : "text-ink"}`}>{paid ? "Pago ✓ R$ 57,00" : "Aguardando R$ 57,00"}</p>
      </div>
    </div>
  );
}

const LOG = ["18:00 pedido recebido", "18:01 pedido aceito", "18:04 em produção", "18:13 saiu para entrega", "18:15 mesa 4 pediu a conta"];

export function DemoTestado({ play }: { play: boolean }) {
  const i = useCycle(LOG.length, 1300, play);
  const visible = [0, 1, 2].map(k => LOG[(i + k) % LOG.length]);
  return (
    <ul className="space-y-1.5 rounded-xl border border-line bg-bg p-4 font-mono text-[11px] text-ink-soft">
      <AnimatePresence initial={false} mode="popLayout">
        {visible.map((line, k) => (
          <motion.li
            key={line}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: k === 2 ? 1 : 0.55, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: EASE }}
            className={k === 2 ? "text-ink" : ""}
          >
            {line}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

export function DemoGratis({ play }: { play: boolean }) {
  const day = useCycle(8, 700, play);
  return (
    <div className="rounded-xl border border-line bg-bg p-4">
      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {Array.from({ length: 7 }, (_, k) => (
          <motion.span
            key={k}
            className="grid aspect-square place-items-center rounded-md border border-line font-mono text-[10px]"
            initial={false}
            animate={{ backgroundColor: k < day ? "var(--accent-strong)" : "rgba(0,0,0,0)", color: k < day ? "#fff" : "var(--ink-soft)" }}
            transition={{ duration: 0.3 }}
          >
            {k + 1}
          </motion.span>
        ))}
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-soft">Sem cartão de crédito</p>
    </div>
  );
}
