import { useEffect } from "react";
import { Link } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

/**
 * 404 amigável do site comercial. O servidor já responde HTTP 404 pra essas
 * URLs (shared/commercialRoutes.ts); o noindex aqui é a segunda camada pra
 * crawlers que executam JS. A meta é removida ao sair, pra não vazar pras
 * outras páginas (SPA).
 */
export default function ComercialNotFound() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = "Página não encontrada | MM System Creator";
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <main id="main-content" tabIndex={-1} className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold text-accent-text">Erro 404</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Página não encontrada</h1>
          <p className="mt-2 text-sm text-ink-soft">O endereço que você acessou não existe ou foi movido.</p>
          <Link
            href="/comercial"
            className="mt-6 inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-[#008cfe] to-[#6146fd] px-4 text-sm font-semibold text-white shadow-md shadow-[#6146fd]/20 transition-all duration-200 hover:brightness-110"
          >
            Voltar para o início
          </Link>
        </div>
      </main>
    </div>
  );
}
