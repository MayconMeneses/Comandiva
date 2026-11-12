import { motion, useTransform, type MotionValue } from "motion/react";
import { CART_TOTAL, DEMO_RESTAURANT, MENU, PICKS, PICK_TOTALS } from "../../data/pedido";
import { formatBRL } from "../../lib/format";
import { GhostCursor } from "./GhostCursor";

/** O quadro 2 ocupa o trecho [A, B] do progresso; o cursor e o carrinho andam dentro dele. */
const A = 1 / 7;
const B = 2 / 7;
const at = (local: number) => A + local * (B - A);
const PICK_AT = [at(0.32), at(0.78)];
const ROWS = MENU.length;
const rowTop = (i: number) => `${((i + 0.5) / ROWS) * 100}%`;
const PICK_ROWS = PICKS.map(id => MENU.findIndex(m => m.id === id));

function Row({ index, pickAt }: { index: number; pickAt: MotionValue<number> | null }) {
  const item = MENU[index];
  return (
    <li className="relative flex items-center justify-between gap-2 border-b border-[#efe6d8] px-3 last:border-b-0">
      {pickAt && <motion.span aria-hidden="true" className="absolute inset-0 bg-[#e7f1ff]" style={{ opacity: pickAt }} />}
      <span className="relative min-w-0">
        <span className="block truncate text-[13px] font-semibold leading-tight text-[#2b2118]">{item.name}</span>
        <span className="block truncate text-[10px] text-[#6b5b49]">{item.hint}</span>
      </span>
      <span className="relative flex shrink-0 items-center gap-2">
        <span className="font-mono text-[11px] text-[#2b2118]">{formatBRL(item.price)}</span>
        <span className="relative grid h-6 w-6 place-items-center rounded-full bg-[#b8452b] text-sm font-bold leading-none text-white">
          +
          {pickAt && (
            <motion.span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-ok text-[9px] text-white" style={{ opacity: pickAt }}>
              1
            </motion.span>
          )}
        </span>
      </span>
    </li>
  );
}

/** Cardápio de demonstração no celular, com o cursor fantasma tocando em dois itens. */
export function PhoneMenu({ progress }: { progress: MotionValue<number> }) {
  const pick0 = useTransform(progress, [PICK_AT[0] - 0.002, PICK_AT[0]], [0, 1]);
  const pick1 = useTransform(progress, [PICK_AT[1] - 0.002, PICK_AT[1]], [0, 1]);
  const picks = [pick0, pick1];

  const left = useTransform(progress, [0, at(0.05), at(0.32), at(0.5), at(0.78), 1], ["104%", "104%", "86%", "86%", "86%", "86%"]);
  const top = useTransform(progress, [0, at(0.05), at(0.32), at(0.5), at(0.78), 1], ["112%", "112%", rowTop(PICK_ROWS[0]), rowTop(PICK_ROWS[0]), rowTop(PICK_ROWS[1]), rowTop(PICK_ROWS[1])]);
  const opacity = useTransform(progress, [at(0), at(0.1)], [0, 1]);
  const press = useTransform(progress, [PICK_AT[0] - 0.012, PICK_AT[0], PICK_AT[0] + 0.012, PICK_AT[1] - 0.012, PICK_AT[1], PICK_AT[1] + 0.012], [1, 0.78, 1, 1, 0.78, 1]);

  const cartText = useTransform(progress, p => formatBRL(p >= PICK_AT[1] ? PICK_TOTALS[1] : p >= PICK_AT[0] ? PICK_TOTALS[0] : 0));
  const cartCount = useTransform(progress, (p): string => (p >= PICK_AT[1] ? "2 itens" : p >= PICK_AT[0] ? "1 item" : "Carrinho vazio"));

  return (
    <>
      <div className="flex h-11 shrink-0 items-center justify-between bg-[#17120e] px-3 text-[#fffaf3]">
        <span className="truncate font-display text-[13px] font-semibold">{DEMO_RESTAURANT}</span>
        <span className="rounded-full bg-[#e9c98f] px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-[#241b16]">Demonstração</span>
      </div>
      <ul className="relative grid min-h-0 flex-1 grid-rows-4">
        {MENU.map((_, i) => {
          const k = PICK_ROWS.indexOf(i);
          return <Row key={MENU[i].id} index={i} pickAt={k >= 0 ? picks[k] : null} />;
        })}
        <GhostCursor left={left} top={top} opacity={opacity} scale={press} />
      </ul>
      <div className="flex h-[3.25rem] shrink-0 items-center justify-between bg-[#17120e] px-3 text-[#fffaf3]">
        <motion.span className="text-[11px] text-[#cdbfac]">{cartCount}</motion.span>
        <motion.span className="font-mono text-sm font-semibold tabular-nums text-[#e9c98f]" aria-label={`Total ${formatBRL(CART_TOTAL)}`}>
          {cartText}
        </motion.span>
      </div>
    </>
  );
}
