import { motion } from "motion/react";
import { BOARD_STEPS, type BoardOrder } from "../../data/board";
import { formatBRL } from "../../lib/format";
import { EASE } from "../../lib/motion";

/** Comanda no estilo do painel real (creme, código em vermelho, botão de ação). */
export function OrderCard({ order, featured = false, stepIndex }: { order: BoardOrder; featured?: boolean; stepIndex?: number }) {
  const state = featured && stepIndex !== undefined ? BOARD_STEPS[stepIndex].card : order.state;
  const late = state.tone === "late";

  return (
    <motion.article
      layoutId={featured ? "pedido-destaque" : undefined}
      layout={featured ? true : undefined}
      transition={{ duration: 0.7, ease: EASE }}
      className={`rounded-2xl border bg-[#fffdf7] p-3.5 text-ticket-ink ${
        featured ? "border-accent shadow-[0_0_0_3px_rgba(0,140,254,.25),0_24px_50px_-24px_rgba(0,0,0,.9)]" : "border-[#e8e0d2]"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium text-[#b23a2a]">{order.code}</span>
        <span className="font-mono text-xs font-medium">{formatBRL(order.total)}</span>
      </div>
      <p className="mt-1 font-display text-base font-semibold leading-tight">{order.name}</p>
      <div className="mt-2.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
        <span className="text-ticket-soft">{state.label}</span>
        <span className={late ? "font-medium text-late" : "text-ticket-soft"}>{state.meta}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#efe6d8]">
        <motion.div
          className={`h-full origin-left rounded-full ${late ? "bg-late" : "bg-ok"}`}
          initial={false}
          animate={{ scaleX: state.progress }}
          transition={{ duration: 0.6, ease: EASE }}
        />
      </div>
      <p className="mt-2.5 border-t border-[#efe6d8] pt-2 text-xs text-ticket-soft">{order.items}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="shrink-0 text-[11px] font-medium text-ticket-soft">{order.mode}</span>
        <span className="whitespace-nowrap rounded-full bg-[#b8452b] px-2.5 py-1 text-[11px] font-semibold text-white">{state.action} ›</span>
      </div>
    </motion.article>
  );
}
