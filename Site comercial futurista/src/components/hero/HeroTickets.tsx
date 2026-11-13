import { HERO } from "../../content";
import { LiveTickets } from "../LiveTickets";
import { Marked } from "../ui/Kw";

/** Segunda faixa do topo: as comandas chegando e a comissão de R$ 0 (simulação rotulada). */
export function HeroTickets({ ready }: { ready: boolean }) {
  return (
    <section className="border-t border-line" aria-labelledby="tickets-title">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <h2 id="tickets-title" className="max-w-xl font-display text-[clamp(1.6rem,3.2vw,2.5rem)] font-semibold leading-tight tracking-[-0.02em]">
          <Marked text={HERO.ticketsTitle} phrase="R$ 0" tone="ok" />
        </h2>
        <LiveTickets play={ready} />
      </div>
    </section>
  );
}
