import { Link } from "wouter";
import { usePageMeta } from "../lib/seo";

/** 404 próprio: comanda "extraviada" com caminho de volta. */
export default function NotFound() {
  usePageMeta("/404", { noindex: true });

  return (
    <section className="grid min-h-[70dvh] place-items-center px-4 py-24" aria-labelledby="nf-title">
      <div className="text-center">
        <div className="ticket-edge mx-auto w-[min(18rem,85vw)] -rotate-2 bg-ticket px-5 pb-8 pt-5 text-left font-mono text-[12px] uppercase tracking-wider text-ticket-ink">
          <div className="flex justify-between border-b border-dashed border-ticket-soft/50 pb-3">
            <span className="font-display text-base font-semibold normal-case tracking-tight">Comandiva</span>
            <span className="text-ticket-soft">erro</span>
          </div>
          <div className="flex justify-between pt-3">
            <span className="text-ticket-soft">Pedido</span>
            <span>Nº 404</span>
          </div>
          <div className="flex justify-between pt-2">
            <span className="text-ticket-soft">Status</span>
            <span>Extraviado</span>
          </div>
        </div>
        <h1 id="nf-title" className="mt-10 font-display text-4xl font-semibold tracking-tight">Essa página não está no cardápio</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">O endereço pode ter mudado ou estar digitado errado.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-bg">
            Voltar ao início
          </Link>
          <Link href="/planos" className="inline-flex h-12 items-center rounded-full border border-line px-6 font-semibold">
            Ver planos
          </Link>
        </div>
      </div>
    </section>
  );
}
