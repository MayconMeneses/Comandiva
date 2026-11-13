import { ORDER_TOTAL, STATUS_FLOW } from "../../data/pedido";
import { FEATURED_ORDER } from "../../data/board";
import { formatBRL } from "../../lib/format";

/** QR de demonstração: padrão fixo com os três quadrados de canto (não é um código Pix de verdade). */
const QR_SIZE = 21;
const FINDERS = [[0, 0], [QR_SIZE - 7, 0], [0, QR_SIZE - 7]];
function qrPath() {
  let d = "";
  for (let y = 0; y < QR_SIZE; y++)
    for (let x = 0; x < QR_SIZE; x++) {
      const inFinder = FINDERS.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7);
      if (!inFinder && (x * 7 + y * 13 + x * y) % 5 < 2) d += `M${x} ${y}h1v1h-1z`;
    }
  for (const [fx, fy] of FINDERS) d += `M${fx} ${fy}h7v7h-7zM${fx + 1} ${fy + 1}v5h5v-5zM${fx + 2} ${fy + 2}h3v3h-3z`;
  return d;
}
const QR_D = qrPath();

/** Tela do pedido com a cobrança Pix, como no app (OrderTracking.tsx: QR, copia e cola e confirmação automática). */
export function PhoneCheckout() {
  return (
    <div className="flex h-full flex-col gap-2 bg-[#17120e] p-3 text-[#fffaf3]">
      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#e9c98f]">Resumo do pedido</p>
      <div className="flex justify-between text-[11px]">
        <span>1× Picanha · 1× Pudim</span>
        <span className="font-mono">{formatBRL(ORDER_TOTAL)}</span>
      </div>
      <div className="rounded-xl border border-[#493c2f] bg-[#211a13] p-2.5">
        <p className="text-[12px] font-semibold text-[#f1d7aa]">Pague com Pix agora</p>
        <p className="mt-0.5 text-[9px] leading-snug text-[#cdbfac]">Confirmação automática: o pedido atualiza sozinho assim que você pagar.</p>
        <div className="mt-2 flex items-center gap-2">
          <svg viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`} className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-xl bg-white p-0.5" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
            <path d={QR_D} fill="#241b16" fillRule="evenodd" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] text-[#cdbfac]">Pix copia e cola</p>
            <code className="mt-0.5 block truncate rounded-sm bg-[#fffaf3] px-1.5 py-1 text-[9px] text-[#241b16]">00020126demonstracao</code>
            <span className="mt-1 inline-block rounded-sm border border-[#493c2f] px-2 py-0.5 text-[9px] text-[#f1d7aa]">Copiar</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Acompanhamento do cliente: mesmos nomes de status do app (Pedido recebido, aceito, Em preparo, Saiu para entrega). */
export function PhoneTracking({ statusIndex }: { statusIndex: number }) {
  return (
    <div className="flex h-full flex-col bg-[#fffdf8] p-3 text-[#231d18]">
      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#b8452b]">Pedido em andamento</p>
      <p className="mt-1 font-display text-lg font-bold leading-tight">{STATUS_FLOW[statusIndex]}</p>
      <p className="mt-0.5 font-mono text-[9px] text-[#6b5b49]">{FEATURED_ORDER.code}</p>
      <ol className="mt-3 space-y-2">
        {STATUS_FLOW.slice(0, statusIndex + 1).map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-[11px]">
            <span className={`h-2.5 w-2.5 rounded-full ${i === statusIndex ? "bg-[#b8452b]" : "bg-[#e2d6c5]"}`} aria-hidden="true" />
            <span className={i === statusIndex ? "font-semibold" : "text-[#6b5b49]"}>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
