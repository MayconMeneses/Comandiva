import { Link } from "wouter";
import { PRIVACIDADE_URL, TERMOS_URL } from "../content";

export function Footer() {
  return (
    <footer className="border-t border-dashed border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <img src="/comandiva-icon.png" alt="" width={52} height={64} className="h-6 w-auto" />
            <span className="font-display text-base font-semibold">Comandiva</span>
          </Link>
          <p className="mt-2 max-w-xs text-sm text-ink-soft">Sistema para restaurante com a sua marca e zero comissão por pedido.</p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
          <Link href="/planos" className="hover:text-ink">
            Planos
          </Link>
          <a href={TERMOS_URL} className="hover:text-ink">
            Termos de uso
          </a>
          <a href={PRIVACIDADE_URL} className="hover:text-ink">
            Política de privacidade
          </a>
        </nav>
      </div>
      <p className="pb-8 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">© 2026 Comandiva</p>
    </footer>
  );
}
