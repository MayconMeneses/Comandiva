import { Link } from "wouter";

function IconLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
function IconShieldCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/**
 * Rodapé compartilhado das páginas públicas — mesma ideia do ComercialHeader.
 * Traz os selos de confiança e o crédito de autoria que um site comercial de
 * verdade precisa ter (pedido explícito do dono do projeto).
 */
export function ComercialFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-6 text-center">
        <img src="/mm-logo-icon.png" alt="" aria-hidden="true" className="h-9 w-9 rounded-md" />

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <IconLock className="h-4 w-4 text-emerald-400" /> Suas informações ficam protegidas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconShieldCheck className="h-4 w-4 text-emerald-400" /> Pagamento processado com segurança pelo Mercado Pago
          </span>
        </div>

        <p className="text-sm text-ink-soft">
          Criado do zero por <strong className="text-ink">Maycon Meneses</strong> — MM System Creator
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          <span>© {new Date().getFullYear()} MM System Creator. Todos os direitos reservados.</span>
          <Link
            href="/comercial/termos"
            className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Termos de uso
          </Link>
          <Link
            href="/comercial/privacidade"
            className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Privacidade
          </Link>
        </div>
      </div>
    </footer>
  );
}
