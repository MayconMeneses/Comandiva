import { Link } from "wouter";
import { asset } from "../lib/asset";

/** Menu em "ilha": pílula flutuante, destacada do topo (referência: Floating Navbar, 21st.dev). */
export function Header() {
  return (
    <header className="pointer-events-none sticky top-0 z-50 px-3 pt-3 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border border-white/10 bg-[#0a0f26]/92 pl-4 pr-1.5 shadow-[0_10px_40px_-20px_rgba(0,0,0,.9)]">
        <Link href="/" className="flex items-center gap-2" aria-label="Comandiva, início">
          <img src={asset("/comandiva-icon.png")} alt="" width={52} height={64} className="h-6 w-auto" />
          <span className="font-display text-base font-semibold tracking-tight">Comandiva</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-0.5 text-sm">
          <Link href="/#por-dentro" className="hidden rounded-full px-3 py-2 text-ink-soft transition-colors hover:text-ink sm:inline-block">
            Por dentro
          </Link>
          <Link href="/planos" className="hidden rounded-full px-3 py-2 text-ink-soft transition-colors hover:text-ink sm:inline-block">
            Planos
          </Link>
          <Link
            href="/planos"
            className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-semibold text-bg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
          >
            Ver planos
          </Link>
        </nav>
      </div>
    </header>
  );
}
