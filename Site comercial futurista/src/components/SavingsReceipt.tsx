import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { SAVINGS } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { ReceiptPrinter } from "./ui/ReceiptPrinter";
import { Stamp } from "./ui/Stamp";
import { EASE, reveal } from "../lib/motion";

const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Valor que rola até o novo número (referência: Amount Slider, 21st.dev). */
function Rolling({ cents, fmt = brl0 }: { cents: number; fmt?: Intl.NumberFormat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(cents);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = fmt.format(cents / 100);
      return;
    }
    const c = animate(prev.current, cents, { duration: 0.6, ease: EASE, onUpdate: v => (node.textContent = fmt.format(v / 100)) });
    prev.current = cents;
    return () => c.stop();
  }, [cents, reduce, fmt]);
  return (
    <span ref={ref} className="tabular-nums">
      {fmt.format(cents / 100)}
    </span>
  );
}

function Line({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 ${strong ? "text-ticket-ink" : "text-ticket-soft"}`}>
      <span className="shrink-0">{label}</span>
      <span aria-hidden="true" className="min-w-3 flex-1 translate-y-[-3px] border-b border-dotted border-ticket-soft/50" />
      <span className={`shrink-0 ${strong ? "font-medium" : ""}`}>{children}</span>
    </div>
  );
}

/** Um extrato impresso: cabeçalho, linhas e o "Você recebe" em destaque. */
function Receipt({ title, tag, children, received, tone, stamp }: { title: string; tag: string; children: ReactNode; received: number; tone: "app" | "us"; stamp?: ReactNode }) {
  return (
    <div className={`ticket-edge paper-texture relative px-5 pb-20 pt-5 font-mono text-[12px] uppercase tracking-wide ${tone === "app" ? "grayscale-[.35] brightness-[.93]" : ""}`}>
      <div className="flex items-center justify-between border-b border-dashed border-ticket-soft/50 pb-3 text-ticket-ink">
        <span className="font-display text-base font-semibold normal-case tracking-tight">{title}</span>
        <span className="text-ticket-soft">{tag}</span>
      </div>
      <div className="space-y-2.5 pt-4">{children}</div>
      <div className="mt-5 border-t-2 border-dashed border-ticket-ink/70 pt-4 text-ticket-ink">
        <p className="text-[10px] text-ticket-soft">Você recebe no mês</p>
        <p className={`mt-1 font-display text-[1.75rem] font-semibold normal-case leading-none tracking-tight ${tone === "app" ? "text-[#b91c1c]" : "text-ok"}`}>
          <Rolling cents={received} fmt={brl2} />
        </p>
      </div>
      {stamp && <div className="absolute bottom-5 right-4">{stamp}</div>}
    </div>
  );
}

/**
 * "Quanto você deixa de pagar em comissão?": dois extratos impressos lado a
 * lado — app de entrega x Comandiva — terminando no valor que o restaurante
 * RECEBE em cada caso (pedido do dono). Mesmo cálculo do site atual: até 30%
 * de comissão x mensalidade fixa do plano de entrada.
 */
export function SavingsReceipt() {
  const [revenue, setRevenue] = useState(SAVINGS.defaultCents);
  const commission = Math.round(revenue * SAVINGS.commissionRate);
  const receivedApp = revenue - commission;
  const receivedUs = revenue - SAVINGS.basePlanCents;
  const diff = Math.max(0, receivedUs - receivedApp);
  const pct = ((revenue - SAVINGS.minCents) / (SAVINGS.maxCents - SAVINGS.minCents)) * 100;

  // Reimprime os extratos quando o valor para de mudar (não a cada passo do slider).
  const [printKey, setPrintKey] = useState(0);
  const [stamped, setStamped] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      setStamped(false);
      setPrintKey(k => k + 1);
    }, 650);
    return () => clearTimeout(t);
  }, [revenue]);

  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="calc-title">
      <SectionHeading
        id="calc-title"
        eyebrow="Faça a conta"
        title="Quanto fica no seu bolso no fim do mês?"
        lead="Arraste até o faturamento mensal do seu restaurante e compare os dois extratos."
      />

      <motion.div {...reveal(0.1)} className="mx-auto mt-14 max-w-2xl">
        <label htmlFor="faturamento" className="block text-center text-sm font-medium text-ink-soft">
          Faturamento mensal em pedidos
        </label>
        <p className="mt-2 text-center font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-none tracking-tight" aria-hidden="true">
          <Rolling cents={revenue} />
        </p>
        <input
          id="faturamento"
          type="range"
          min={SAVINGS.minCents}
          max={SAVINGS.maxCents}
          step={SAVINGS.stepCents}
          value={revenue}
          onChange={e => setRevenue(Number(e.target.value))}
          aria-valuetext={brl0.format(revenue / 100)}
          className="range-comanda mt-6 w-full"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-soft">
          <span>R$ 3 mil</span>
          <span>R$ 100 mil</span>
        </div>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-10 md:grid-cols-2 md:gap-8">
        <motion.div {...reveal(0.15)}>
          <ReceiptPrinter printKey={printKey} label="App de entrega">
            <Receipt title="Com app de entrega" tag="simulação" received={receivedApp} tone="app">
              <Line label="Vendas no mês">
                <Rolling cents={revenue} />
              </Line>
              <Line label="Comissão até 30%" strong>
                <span className="text-[#b91c1c]">
                  −<Rolling cents={commission} />
                </span>
              </Line>
              <Line label="Mensalidade">—</Line>
            </Receipt>
          </ReceiptPrinter>
        </motion.div>

        <motion.div {...reveal(0.25)}>
          <ReceiptPrinter printKey={printKey} label="Comandiva" onPrinted={() => setStamped(true)}>
            <Receipt
              title="Com a Comandiva"
              tag="simulação"
              received={receivedUs}
              tone="us"
              stamp={<Stamp key={printKey} text="Comissão R$ 0" sub="Comandiva" tone="ok" rotate={-9} play={stamped} />}
            >
              <Line label="Vendas no mês">
                <Rolling cents={revenue} />
              </Line>
              <Line label="Comissão">R$ 0</Line>
              <Line label="Mensalidade fixa" strong>
                −{brl2.format(SAVINGS.basePlanCents / 100)}
              </Line>
            </Receipt>
          </ReceiptPrinter>
        </motion.div>
      </div>

      <motion.div {...reveal(0.1)} className="mx-auto mt-12 max-w-2xl text-center">
        <p className="text-lg text-ink-soft">
          Com a Comandiva ficam{" "}
          <strong className="font-display text-2xl font-semibold text-accent-text">
            +<Rolling cents={diff} fmt={brl2} />
          </strong>{" "}
          a mais no seu bolso por mês — <span className="text-ink">
            <Rolling cents={diff * 12} />
          </span>{" "}
          por ano.
        </p>
        <p className="mt-4 text-xs text-ink-soft">
          Estimativa educativa a partir do plano de entrada e de uma comissão comum de mercado (até 30%) — o valor exato do seu app de
          entrega pode variar. Taxas de pagamento (Pix e cartão) existem nos dois casos e não entram na conta.
        </p>
      </motion.div>
    </section>
  );
}
