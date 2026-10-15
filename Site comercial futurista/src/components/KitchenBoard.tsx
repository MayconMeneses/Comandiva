import { useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useScroll } from "motion/react";
import { scrollToTarget } from "../lib/scroll";
import { BOARD_COLUMNS, BOARD_STEPS, FEATURED_ORDER, type BoardOrder } from "../data/board";
import { formatBRL } from "../lib/format";

const EASE = [0.32, 0.72, 0, 1] as const;

/** Comanda no estilo do painel real (creme, código em vermelho, botão de ação). */
function OrderCard({ order, featured = false, stepIndex }: { order: BoardOrder; featured?: boolean; stepIndex?: number }) {
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
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-ticket-soft">{order.mode}</span>
        <span className="rounded-full bg-[#b8452b] px-3 py-1 text-[11px] font-semibold text-white">{state.action} ›</span>
      </div>
    </motion.article>
  );
}

/**
 * "Veja por dentro": recriação do painel de pedidos que anda conforme a
 * rolagem. A seção fica presa na tela (sticky) e cada trecho de rolagem
 * leva o pedido em destaque para a próxima etapa. Os passos também são
 * botões, para quem navega por teclado.
 */
export function KitchenBoard() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", p => {
    const next = Math.min(BOARD_STEPS.length - 1, Math.max(0, Math.floor(p * BOARD_STEPS.length * 0.999)));
    setStep(s => (s === next ? s : next));
  });

  function goToStep(i: number) {
    const el = ref.current;
    if (!el) return;
    const range = el.offsetHeight - window.innerHeight;
    scrollToTarget(el.offsetTop + range * ((i + 0.5) / BOARD_STEPS.length));
  }

  const current = BOARD_STEPS[step];
  const delivered = current.column === null;

  return (
    <section id="por-dentro" ref={ref} className="relative h-[340vh]" aria-labelledby="por-dentro-title">
      <div className="sticky top-0 flex min-h-[100dvh] items-center overflow-hidden py-24">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:gap-12">
          <div>
            <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">
              Veja por dentro
            </p>
            <h2 id="por-dentro-title" className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1] tracking-[-0.02em] text-balance">
              Um pedido, do celular do cliente até a entrega
            </h2>

            <ol className="mt-6 hidden space-y-1 lg:block">
              {BOARD_STEPS.map((s, i) => (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    aria-current={i === step ? "step" : undefined}
                    className="group relative w-full rounded-xl py-2.5 pl-11 pr-3 text-left"
                  >
                    {i === step && (
                      <motion.span layoutId="passo-ativo" className="absolute inset-0 rounded-xl bg-bg-raised" transition={{ duration: 0.5, ease: EASE }} />
                    )}
                    <span
                      className={`absolute left-3 top-3 grid h-5 w-5 place-items-center rounded-full font-mono text-[10px] ${
                        i <= step ? "bg-accent text-white" : "border border-line text-ink-soft"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`relative block font-semibold ${i === step ? "text-ink" : "text-ink-soft"}`}>{s.title}</span>
                    {i === step && <span className="relative mt-0.5 block text-sm text-ink-soft">{s.text}</span>}
                  </button>
                </li>
              ))}
            </ol>

            {/* Celular: só o passo atual, sem lista longa */}
            <div className="mt-5 lg:hidden" aria-live="polite">
              <p className="font-mono text-xs text-accent-text">
                {step + 1}/{BOARD_STEPS.length} · {current.title}
              </p>
              <p className="mt-1 text-sm text-ink-soft">{current.text}</p>
            </div>
          </div>

          <div className="self-center rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
            <div className="rounded-[calc(2rem-0.375rem)] bg-[#f6f1e8] p-3 md:min-h-[28.5rem] shadow-[inset_0_1px_1px_rgba(255,255,255,.6)] sm:p-4">
              <LayoutGroup>
                <div className="grid gap-3 md:grid-cols-3">
                  {BOARD_COLUMNS.map((col, ci) => {
                    const active = current.column === ci || (delivered && ci === 2);
                    return (
                      <div
                        key={col.title}
                        className={`flex-col gap-2.5 rounded-2xl border border-[#e8e0d2] p-2.5 ${col.bg} ${active ? "flex" : "hidden md:flex"}`}
                      >
                        <div className="px-1 pt-1">
                          <p className="font-display text-sm font-semibold text-ticket-ink">{col.title}</p>
                          <p className="text-[11px] text-ticket-soft">{col.hint}</p>
                        </div>
                        {current.column === ci && <OrderCard order={FEATURED_ORDER} featured stepIndex={step} />}
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
        </div>

        <p className="absolute bottom-5 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          Recriação do painel real · dados de demonstração
        </p>
      </div>
    </section>
  );
}
