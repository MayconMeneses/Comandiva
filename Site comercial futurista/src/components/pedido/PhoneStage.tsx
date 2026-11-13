import { motion, useTransform, type MotionValue } from "motion/react";
import { EASE } from "../../lib/motion";
import { PhoneMenu } from "./PhoneMenu";
import { PhoneCheckout, PhoneTracking } from "./PhoneViews";

/**
 * Celular do cliente. Centralizado nos quadros 1 a 3; do quadro 4 em diante
 * recua (menor, à esquerda) para dar lugar ao painel. No celular de verdade
 * (tela estreita) ele some nesse trecho e o painel ocupa tudo.
 */
export function PhoneStage({ beat, progress, enter, statusIndex }: { beat: number; progress: MotionValue<number>; enter: MotionValue<number>; statusIndex: number }) {
  const docked = beat >= 3;
  const hidden = beat >= 7;
  const fade = useTransform(enter, [0.25, 0.9], [0, 1]);
  const rise = useTransform(enter, [0, 1], [48, 0]);

  return (
    <motion.div
      className={`absolute top-0 ${docked ? "max-md:hidden" : ""}`}
      style={{ transformOrigin: "top left" }}
      initial={false}
      animate={{ left: docked ? "0%" : "50%", x: docked ? "0%" : "-50%", scale: docked ? 0.62 : 1, opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <motion.div style={{ opacity: fade, y: rise }} className="w-[14.5rem] rounded-[2rem] border border-band-line bg-[#0d0f14] p-1.5">
        <div className="flex h-[21rem] flex-col overflow-hidden rounded-3xl bg-[#fffdf8] md:h-[24.5rem]">
          {beat <= 1 ? <PhoneMenu progress={progress} /> : beat === 2 ? <PhoneCheckout /> : <PhoneTracking statusIndex={statusIndex} />}
        </div>
      </motion.div>
    </motion.div>
  );
}
