import type { ReactNode } from "react";
import { HERO } from "../../content";

const ICONS: ReactNode[] = [
  // 7 dias grátis: calendário
  <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  // sem cartão: cartão riscado
  <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18M4 4l16 16" /></>,
  // sem comissão: percentual
  <><path d="M18 6 6 18" /><circle cx="7.5" cy="7.5" r="2" /><circle cx="16.5" cy="16.5" r="2" /></>,
  // cancele quando quiser: porta aberta
  <><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9" /></>,
];

/** Selos de risco zero em linha curta, junto ao botão principal. Só condições que já constam em Planos/Termos. */
export function TrustSeals() {
  return (
    <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft" aria-label="Condições">
      {HERO.checks.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="h-[1.125rem] w-[1.125rem] shrink-0 text-hero" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[i]}
          </svg>
          {label}
        </li>
      ))}
    </ul>
  );
}
