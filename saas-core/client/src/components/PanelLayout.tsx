import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/", area: null },
  { label: "Restaurantes", path: "/restaurantes", area: "restaurantes" },
  { label: "Planos", path: "/planos", area: "planos" },
  { label: "Auditoria", path: "/auditoria", area: "auditoria" },
  { label: "Equipe", path: "/equipe", area: "equipe" },
  { label: "Manutenção", path: "/manutencao", area: "manutencao" },
] as const;

export function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin, loading, logout } = usePlatformAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !admin) setLocation("/login");
  }, [loading, admin, setLocation]);

  if (loading) return <div className="grid min-h-screen place-items-center text-ink-soft">Carregando…</div>;
  if (!admin) return null;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-paper-raised p-4">
        <p className="px-2 text-xs font-bold uppercase tracking-wider text-accent">Painel Master</p>
        <nav className="mt-4 flex flex-col gap-1">
          {NAV_ITEMS.filter(item => !item.area || admin.permissions.includes(item.area)).map(item => (
            <Link
              key={item.path}
              href={item.path}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${location === item.path ? "bg-accent text-white" : "text-ink-soft hover:bg-paper"}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-border pt-3">
          <p className="truncate px-2 text-xs text-ink-soft">{admin.email}</p>
          <button type="button" onClick={() => logout()} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft hover:bg-paper">
            Sair
          </button>
        </div>
      </aside>
      <main className="relative flex-1 overflow-hidden p-6">
        {/* Marca d'água — puramente decorativa, atrás do conteúdo real (z-0 vs z-10), sem interceptar clique. Centralizada de verdade (top/left 50% + translate -50%), não ancorada num canto — evita cortar a imagem contra o overflow-hidden do <main>. */}
        <img src="/mm-logo-full.png" alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[32rem] max-w-[70vw] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] select-none" />
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}
