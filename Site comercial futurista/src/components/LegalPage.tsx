import type { ReactNode } from "react";

/** Moldura das páginas de texto (Termos, Privacidade): leitura confortável, sem efeitos. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pb-24 pt-16 sm:px-6" aria-labelledby="legal-title">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-text">Comandiva</p>
      <h1 id="legal-title" className="mt-3 font-display text-4xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Última atualização: {updated}</p>
      <div className="mt-10 space-y-8 leading-relaxed text-ink-soft [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_strong]:text-ink">
        {children}
      </div>
    </article>
  );
}
