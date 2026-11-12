import { EXTRATO, FRAMES } from "../../data/pedido";
import { scrollToTarget } from "../../lib/scroll";

/** Os 7 quadros como lista legível. Em `srOnly`, é a história em texto para leitor de tela (a cena visual fica oculta). */
export function StoryList({ srOnly = false }: { srOnly?: boolean }) {
  return (
    <ol className={srOnly ? "sr-only" : "mt-8 space-y-3"}>
      {FRAMES.map((f, i) => (
        <li key={f.title} className={srOnly ? undefined : "rounded-2xl border border-line bg-bg-raised p-4"}>
          <h3 className="font-display text-lg font-semibold">
            <span className="mr-2 font-mono text-xs text-accent-text">{i + 1}</span>
            {f.title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">{f.text}</p>
          <p className="mt-1 font-mono text-xs text-ink-soft">{f.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function CalcButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => scrollToTarget("#calc-title")}
      className={`min-h-11 rounded-full border border-line px-5 py-2 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      Calcular com o seu faturamento
    </button>
  );
}

/** Versão sem rolagem presa e sem cursor: movimento reduzido ou tela de até 360 px. */
export function StaticSequence() {
  return (
    <section id="por-dentro" className="mx-auto max-w-3xl px-4 py-24 sm:px-6" aria-labelledby="por-dentro-title">
      <p className="inline-flex rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-text">Veja por dentro</p>
      <h2 id="por-dentro-title" className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] font-semibold leading-[1] tracking-[-0.02em] text-balance">
        A vida de um pedido, do cardápio ao fim do mês
      </h2>
      <StoryList />
      <p className="mt-4 text-xs text-ink-soft">Recriação do painel real · dados de demonstração. {EXTRATO.note}</p>
      <CalcButton className="mt-4" />
    </section>
  );
}
