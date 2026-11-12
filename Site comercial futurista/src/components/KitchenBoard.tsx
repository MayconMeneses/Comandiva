import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { BOARD_COLUMNS, BOARD_STEPS, FEATURED_ORDER } from "../data/board";
import { EASE } from "../lib/motion";
import { OrderCard } from "./pedido/OrderCard";

/**
 * Painel de pedidos recriado (colunas Aguardando aceite, Aceitos e Em produção).
 * O pedido em destaque anda entre as colunas conforme `stepIndex` (índice em
 * BOARD_STEPS); o resto da cena fica em components/pedido.
 */
export function KitchenBoard({ stepIndex }: { stepIndex: number }) {
  const current = BOARD_STEPS[stepIndex];
  const delivered = current.column === null;

  return (
    <div className="h-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
      <div className="h-full overflow-hidden rounded-[calc(2rem-0.375rem)] bg-[#f6f1e8] p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,.6)] sm:p-4">
        <LayoutGroup>
          <div className="grid gap-3 md:grid-cols-3">
            {BOARD_COLUMNS.map((col, ci) => {
              const active = current.column === ci || (delivered && ci === 2);
              return (
                <div key={col.title} className={`flex-col gap-2.5 rounded-2xl border border-[#e8e0d2] p-2.5 ${col.bg} ${active ? "flex" : "hidden md:flex"}`}>
                  <div className="px-1 pt-1">
                    <p className="font-display text-sm font-semibold text-ticket-ink">{col.title}</p>
                    <p className="text-[11px] text-ticket-soft">{col.hint}</p>
                  </div>
                  {current.column === ci && <OrderCard order={FEATURED_ORDER} featured stepIndex={stepIndex} />}
                  <AnimatePresence>
                    {delivered && ci === 2 && (
                      <motion.p
                        initial={{ opacity: 0, scale: 0.9, rotate: -4 }}
                        animate={{ opacity: 1, scale: 1, rotate: -2 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="rounded-xl border-2 border-dashed border-ok px-3 py-2.5 text-center font-mono text-[11px] font-medium uppercase tracking-wider text-ok"
                      >
                        ✓ {FEATURED_ORDER.name} · saiu para entrega
                      </motion.p>
                    )}
                  </AnimatePresence>
                  {col.orders.map(o => (
                    <OrderCard key={o.code} order={o} />
                  ))}
                </div>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </div>
  );
}
