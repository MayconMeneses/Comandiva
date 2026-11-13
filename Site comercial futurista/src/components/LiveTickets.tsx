import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { APP_FEE_RATE, DEMO_ORDERS } from "../content";
import { formatBRL } from "../lib/format";

const VISIBLE = 3;
const INTERVAL_MS = 2600;

const STAGES = [
  { label: "Aguardando aceite", tone: "bg-warn", progress: 0.2 },
  { label: "Aceito", tone: "bg-accent", progress: 0.45 },
  { label: "Em produção", tone: "bg-ok", progress: 0.75 },
];

type Ticket = { id: number; orderIndex: number; time: string };

function clock(minutesAfterSix: number) {
  const m = 18 * 60 + minutesAfterSix;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Número que rola até o valor novo (referência: "Number Ticker", 21st.dev). */
function Ticker({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => (node.textContent = formatBRL(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {formatBRL(value)}
    </span>
  );
}

/**
 * Fila de comandas chegando "ao vivo" + medidor de comissão. É uma
 * simulação (avisada na tela) com os mesmos pedidos fictícios dos prints
 * reais do painel. Pausa fora da tela. Roda mesmo com "reduzir movimento": é uma demo pequena e contida, sem deslocamento da página.
 */
export function LiveTickets({ play }: { play: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  // "some": roda assim que qualquer parte aparece. Em celular a lista é mais alta que o que
  // cabe abaixo dos botões, então exigir uma fração dela (amount) deixava a demo parada ao abrir.
  const inView = useInView(root, { amount: "some" });
  const reduce = useReducedMotion();
  const [count, setCount] = useState(VISIBLE);

  const running = play && inView;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setCount(c => c + 1), INTERVAL_MS);
    return () => clearInterval(t);
  }, [running]);

  const tickets: Ticket[] = [];
  for (let n = count - 1; n >= Math.max(0, count - VISIBLE); n--) {
    tickets.push({ id: n, orderIndex: n % DEMO_ORDERS.length, time: clock(n * 3) });
  }
  let sold = 0;
  for (let n = 0; n < count; n++) sold += DEMO_ORDERS[n % DEMO_ORDERS.length].total;

  return (
    <div ref={root} className="relative">
      <div className="mb-3 flex items-center justify-between text-xs text-ink-soft">
        <span className="flex items-center gap-2">
          <span className="live-dot h-2 w-2 rounded-full bg-warm" />
          Pedidos chegando
        </span>
        <span className="rounded-full bg-tint px-2.5 py-1 font-medium text-warm-ink">Simulação</span>
      </div>

      <ol className="relative flex flex-col gap-3" aria-label="Exemplo de pedidos no painel">
        <AnimatePresence initial={!reduce} mode="popLayout">
          {tickets.map((t, position) => {
            const order = DEMO_ORDERS[t.orderIndex];
            const stage = STAGES[Math.min(position, STAGES.length - 1)];
            return (
              <motion.li
                key={t.id}
                layout
                initial={reduce ? false : { clipPath: "inset(0 0 100% 0)", y: -16 }}
                animate={play || count > VISIBLE ? { clipPath: "inset(0 0 0% 0)", y: 0, opacity: 1 } : undefined}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
                transition={{ duration: 0.7, delay: count === VISIBLE ? position * 0.14 : 0, ease: [0.22, 1, 0.36, 1] }}
                className="ticket-edge border-x border-t border-line bg-ticket px-4 pb-5 pt-3.5 text-ticket-ink"
              >
                <div className="flex items-center justify-between font-mono text-xs tracking-wide text-ticket-soft">
                  <span>{order.code}</span>
                  <span>{t.time}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-lg font-bold leading-tight">{order.name}</span>
                  <span className="font-mono text-sm font-medium">{formatBRL(order.total)}</span>
                </div>
                <p className="mt-0.5 text-sm text-ticket-soft">{order.items}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span>{stage.label}</span>
                  <span className="text-ticket-soft">{order.mode}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ticket-ink/10">
                  <motion.div
                    className={`h-full origin-left rounded-full ${stage.tone}`}
                    initial={false}
                    animate={{ scaleX: stage.progress }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line text-xs">
        <div className="bg-bg p-3">
          <dt className="text-ink-soft">Vendido</dt>
          <dd className="mt-1 font-mono text-[1.2rem] font-bold leading-[1.4286] text-ink">
            <Ticker value={sold} />
          </dd>
        </div>
        <div className="bg-tint p-3">
          <dt className="text-ink-soft">App levaria*</dt>
          <dd className="mt-1 font-mono text-[1.2rem] font-bold leading-[1.4286] text-late-ink">
            <Ticker value={sold * APP_FEE_RATE} />
          </dd>
        </div>
        <div className="bg-ok-bg p-3">
          <dt className="text-ink-soft">Comandiva</dt>
          <dd className="mt-1 font-mono text-[1.2rem] font-bold leading-[1.4286] text-ok">R$ 0,00</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-ink-soft">
        *Simulação com comissão de 30%, o teto cobrado por apps de entrega. Na Comandiva a mensalidade é fixa.
      </p>
    </div>
  );
}
