import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { asset } from "../lib/asset";
import { scrollToHashWhenReady } from "../lib/scroll";

/** Menu branco colado ao topo, com uma linha embaixo; ao rolar ganha uma sombra leve (a página saiu do topo). */
export function Header() {
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg-raised">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-full h-3 shadow-[0_6px_10px_-8px_rgba(20,24,31,0.28)] transition-opacity duration-200 ease-out ${scrolled ? "opacity-100" : "opacity-0"}`}
      />
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 min-w-11 items-center gap-2" aria-label="Comandiva, início">
          <img src={asset("/comandiva-icon.png")} alt="" width={52} height={64} className="h-6 w-auto" />
          <span className="hidden text-base font-bold tracking-tight min-[400px]:inline">Comandiva</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 text-sm">
          <Link
            href="/#por-dentro"
            // Já na Home o roteador só troca o endereço (não rola); vindo de outra página, o App rola ao chegar.
            onClick={e => {
              if (location !== "/") return;
              e.preventDefault();
              history.pushState(null, "", asset("/#por-dentro"));
              scrollToHashWhenReady("#por-dentro");
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-ink-soft transition-colors hover:text-ink"
          >
            Por dentro
          </Link>
          <Link href="/planos" className="hidden min-h-11 min-w-11 items-center justify-center rounded-xl px-3 text-ink-soft transition-colors hover:text-ink sm:inline-flex">
            Planos
          </Link>
          <Link
            href="/planos"
            className="inline-flex h-11 items-center rounded-xl bg-accent px-4 font-semibold text-white transition-colors hover:bg-accent-hover sm:px-5"
          >
            Ver planos
          </Link>
        </nav>
      </div>
    </header>
  );
}
