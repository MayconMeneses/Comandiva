import { AnimatePresence, motion } from "motion/react";
import { BEAT_BOARD_STEP, BEAT_FRAME, FRAMES } from "../../data/pedido";
import { EASE } from "../../lib/motion";
import { KitchenBoard } from "../KitchenBoard";
import { MiniReceipts } from "./MiniReceipts";
import { PhoneStage } from "./PhoneStage";
import { CalcButton, StoryList } from "./StaticSequence";
import { StepNav } from "./StepNav";
import { useSceneProgress } from "./useSceneProgress";

/**
 * "Veja por dentro": a vida de um pedido em 7 quadros, presa na tela
 * (sticky) enquanto a rolagem conduz a história. Só o quadro atual vira
 * estado React; cursor, carrinho e entrada do celular usam MotionValues.
 */
export default function PedidoScene() {
  const { ref, progress, enter, beat, goToFrame } = useSceneProgress();
  const frame = BEAT_FRAME[beat];
  const boardStep = BEAT_BOARD_STEP[Math.min(beat, 6)] ?? 0;
  const statusIndex = Math.max(0, Math.min(3, beat - 3));
  const showPanel = beat >= 3 && beat <= 6;
  const last = frame === FRAMES.length - 1;

  return (
    <section id="por-dentro" ref={ref} className="relative h-[400vh] max-[768px]:h-[260vh]" aria-labelledby="por-dentro-title">
      <div className="sticky top-0 flex min-h-[100dvh] items-center overflow-hidden py-14 md:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.7fr)] lg:gap-10">
          <div>
            <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">Veja por dentro</p>
            <h2 id="por-dentro-title" className="mt-3 font-display text-[clamp(1.6rem,3.2vw,2.6rem)] font-semibold leading-[1] tracking-[-0.02em] text-balance">
              A vida de um pedido, do cardápio ao fim do mês
            </h2>
            <StoryList srOnly />
            <StepNav frame={frame} onSelect={goToFrame} />
            <CalcButton className={`mt-4 ${last ? "" : "max-lg:hidden"}`} />
          </div>

          <div aria-hidden="true" className="relative mx-auto h-[22rem] w-full self-center md:h-[31rem]">
            <PhoneStage beat={beat} progress={progress} enter={enter} statusIndex={statusIndex} />
            <motion.div
              className="absolute inset-y-0 right-0 left-0 md:left-[9.75rem]"
              initial={false}
              animate={{ opacity: showPanel ? 1 : 0, x: beat >= 3 ? 0 : 48 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{ pointerEvents: "none" }}
            >
              <KitchenBoard stepIndex={boardStep} />
            </motion.div>
            <AnimatePresence>{beat === 7 && <MiniReceipts key="extrato" />}</AnimatePresence>
          </div>
        </div>

        <p className="absolute bottom-3 left-0 right-0 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          Recriação do painel real · dados de demonstração
        </p>
      </div>
    </section>
  );
}
