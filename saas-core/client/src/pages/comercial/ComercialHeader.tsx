import { Link } from "wouter";
import { useEffect } from "react";

const PRIMARY_LINK_CLASSES =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#008cfe] to-[#6146fd] px-4 text-sm font-semibold text-white shadow-md shadow-[#6146fd]/20 transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

/**
 * Cabeçalho compartilhado das páginas públicas (/comercial/*). A logo real
 * (client/public/mm-logo-full.png) já vem com fundo escuro embutido (não é
 * PNG com transparência) — por isso fica dentro de um badge escuro em vez de
 * solta direto no header claro, senão apareceria uma caixa mal-encaixada.
 */
export function ComercialHeader({ showNav = true }: { showNav?: boolean }) {
  useEffect(() => {
    document.title = "MM System Creator — Sistema para restaurantes";
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-paper/90 backdrop-blur">
      <div className="flex w-full items-center justify-between px-6 py-3">
        <Link
          href="/comercial"
          className="inline-flex items-center rounded-lg bg-[#1a1a1a] px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <img
            src="/mm-logo-full.png"
            alt="MM System Creator"
            width={1400}
            height={594}
            className="h-7 w-auto sm:h-8"
          />
        </Link>
        {showNav && (
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/comercial/planos"
              className="hidden rounded text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:inline"
            >
              Planos
            </Link>
            <Link href="/comercial/planos" className={PRIMARY_LINK_CLASSES}>
              Começar agora
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
