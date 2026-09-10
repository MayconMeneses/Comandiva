import { Link } from "wouter";

export default function Sucesso() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <div className="w-full max-w-md rounded-2xl border border-border bg-paper-raised p-6 text-center shadow-sm">
        <span className="text-4xl">🎉</span>
        <h1 className="mt-4 text-2xl font-bold text-ink">Cadastro recebido!</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Seu teste grátis de 14 dias já começou. Nossa equipe vai entrar em contato em breve pra
          configurar o sistema do seu restaurante de acordo com o seu cardápio e sua operação.
        </p>
        <Link href="/comercial" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          Voltar para a página inicial
        </Link>
      </div>
    </div>
  );
}
