import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { EXTRATO } from "../../data/pedido";
import { formatBRL } from "../../lib/format";
import { ReceiptPrinter } from "../ui/ReceiptPrinter";
import { Stamp } from "../ui/Stamp";

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-ticket-soft">
      <span className="shrink-0">{label}</span>
      <span aria-hidden="true" className="hidden min-w-1 flex-1 -translate-y-0.5 min-[480px]:block border-b border-dotted border-ticket-soft/50" />
      <span className="ml-auto shrink-0 text-ticket-ink">{children}</span>
    </div>
  );
}

function Ticket({ title, children, received, tone, stamp }: { title: string; children: ReactNode; received: number; tone: "app" | "us"; stamp?: ReactNode }) {
  return (
    <div className={`ticket-edge paper-texture relative px-3 pb-14 pt-3 font-mono text-[9px] uppercase tracking-wide md:text-[11px] ${tone === "app" ? "grayscale-[.35] brightness-[.93]" : ""}`}>
      <div className="flex items-center justify-between border-b border-dashed border-ticket-soft/50 pb-2 text-ticket-ink">
        <span className="font-display text-xs font-semibold normal-case tracking-tight md:text-sm">{title}</span>
        <span className="text-ticket-soft">simulação</span>
      </div>
      <div className="space-y-1.5 pt-2.5">{children}</div>
      <div className="mt-3 border-t-2 border-dashed border-ticket-ink/70 pt-2 text-ticket-ink">
        <p className="text-[8px] text-ticket-soft md:text-[10px]">Você recebe no mês</p>
        <p className={`mt-0.5 font-display text-base font-semibold normal-case leading-none tracking-tight md:text-xl ${tone === "app" ? "text-[#b91c1c]" : "text-ok"}`}>{formatBRL(received)}</p>
      </div>
      {stamp && <div className="absolute bottom-2 right-2 origin-bottom-right max-md:scale-[.7]">{stamp}</div>}
    </div>
  );
}

/** Quadro final: dois mini-extratos (app de entrega x Comandiva), com os números da calculadora. */
export function MiniReceipts() {
  const [stamped, setStamped] = useState(false);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0 flex flex-col justify-center">
      <div className="grid grid-cols-2 gap-3 md:gap-8">
        <ReceiptPrinter printKey="app" label="App de entrega">
          <Ticket title="Com app de entrega" received={EXTRATO.receivedApp} tone="app">
            <Line label="Vendas">{formatBRL(EXTRATO.sales)}</Line>
            <Line label="Comissão até 30%">
              <span className="text-[#b91c1c]">-{formatBRL(EXTRATO.commission)}</span>
            </Line>
          </Ticket>
        </ReceiptPrinter>
        <ReceiptPrinter printKey="us" label="Comandiva" onPrinted={() => setStamped(true)}>
          <Ticket
            title="Com a Comandiva"
            received={EXTRATO.receivedUs}
            tone="us"
            stamp={<Stamp text="Comissão R$ 0" sub="Comandiva" tone="ok" rotate={-9} play={stamped} />}
          >
            <Line label="Vendas">{formatBRL(EXTRATO.sales)}</Line>
            <Line label="Comissão">R$ 0</Line>
            <Line label="Mensalidade">-{formatBRL(EXTRATO.plan)}</Line>
          </Ticket>
        </ReceiptPrinter>
      </div>
      <p className="mx-auto mt-4 max-w-md text-center text-[11px] text-ink-soft">{EXTRATO.note}</p>
    </motion.div>
  );
}
