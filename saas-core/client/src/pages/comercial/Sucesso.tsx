import { Link } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

export default function Sucesso() {
  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-paper-raised p-6 text-center shadow-sm">
          <span className="text-4xl">🎉</span>
          <h1 className="mt-4 text-2xl font-bold text-ink">Cadastro recebido!</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Nossa equipe vai entrar em contato em breve pra organizar o cardápio e a configuração do seu
            restaurante — em até 10 dias úteis, podendo ser antes.
          </p>
          <p className="mt-3 rounded-lg bg-paper p-3 text-sm font-medium text-ink">
            Assim que tudo estiver pronto, seu teste grátis de <strong>30 dias</strong> começa a valer —
            sem cartão de crédito.
          </p>
          <Link href="/comercial" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
