import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { track } from "@/lib/track";
import { ComercialHeader } from "./ComercialHeader";

export default function Sucesso() {
  const search = useSearch();
  const restaurantId = new URLSearchParams(search).get("ref");
  useEffect(() => {
    track("signup_success");
  }, []);

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
            Assim que tudo estiver pronto, seu teste grátis de <strong>7 dias</strong> começa a valer —
            sem cartão de crédito.
          </p>

          {restaurantId && (
            <>
              <p className="mt-5 text-sm text-ink-soft">Quer adiantar? Já pode mandar seu cardápio agora.</p>
              <Link
                href={`/comercial/cadastro/cardapio?ref=${restaurantId}`}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#008cfe] to-[#6146fd] px-4 text-sm font-semibold text-white shadow-md shadow-[#6146fd]/20 transition-all duration-200 hover:brightness-110"
              >
                Enviar cardápio agora
              </Link>
            </>
          )}

          <Link href="/comercial" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
