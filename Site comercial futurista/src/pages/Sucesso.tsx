import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { track } from "../lib/track";
import { usePageMeta } from "../lib/seo";
import { Stamp } from "../components/ui/Stamp";

/** "Cadastro recebido": comanda carimbada + atalho para enviar o cardápio (mesmo token do cadastro). */
export default function Sucesso() {
  usePageMeta("/cadastro/sucesso", { noindex: true });
  const params = new URLSearchParams(useSearch());
  const ref = params.get("ref");
  const token = params.get("t");

  useEffect(() => {
    track("signup_success");
  }, []);

  return (
    <section className="mx-auto max-w-lg px-4 pb-24 pt-16 text-center sm:px-6" aria-labelledby="sucesso-title">
      <div className="ticket-edge paper-texture relative mx-auto w-[min(22rem,100%)] px-6 pb-12 pt-6 text-left font-mono text-[12px] uppercase tracking-wide text-ticket-ink">
        <div className="flex justify-between border-b border-dashed border-ticket-soft/50 pb-3">
          <span className="font-display text-base font-semibold normal-case tracking-tight">Comandiva</span>
          <span className="text-ticket-soft">cadastro</span>
        </div>
        <div className="flex justify-between pt-3">
          <span className="text-ticket-soft">Status</span>
          <span>Recebido</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="text-ticket-soft">Configuração</span>
          <span>até 10 dias úteis</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="text-ticket-soft">Teste grátis</span>
          <span>7 dias</span>
        </div>
        <div className="absolute -bottom-2 right-3">
          <Stamp text="Recebido" sub="Comandiva" tone="ok" rotate={-8} delay={0.3} />
        </div>
      </div>

      <h1 id="sucesso-title" className="mt-12 font-display text-4xl font-semibold tracking-tight">
        Cadastro recebido!
      </h1>
      <p className="mx-auto mt-3 max-w-md text-ink-soft">
        Nossa equipe vai entrar em contato em breve pra organizar o cardápio e a configuração do seu restaurante — em até 10 dias úteis,
        podendo ser antes. Assim que tudo estiver pronto, seu teste grátis de 7 dias começa a valer, sem cartão de crédito.
      </p>

      {ref && token && (
        <div className="mt-8">
          <p className="text-sm text-ink-soft">Quer adiantar? Já pode mandar seu cardápio agora.</p>
          <Link
            href={`/cadastro/cardapio?ref=${encodeURIComponent(ref)}&t=${encodeURIComponent(token)}`}
            className="mt-3 inline-flex h-12 items-center justify-center rounded-full bg-accent-strong px-7 font-semibold text-white transition-colors hover:bg-[#0076e0]"
          >
            Enviar cardápio agora
          </Link>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block text-sm text-accent-text hover:underline">
        Voltar para a página inicial
      </Link>
    </section>
  );
}
