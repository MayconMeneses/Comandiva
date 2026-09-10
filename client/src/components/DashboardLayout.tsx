import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import type { StaffPermissionArea } from "@shared/permissions";
import { BarChart3, CalendarDays, ClipboardList, CreditCard, ExternalLink, FileText, History, LayoutDashboard, LayoutGrid, LogOut, MapPinned, PanelLeft, Settings2, Users, UtensilsCrossed, Wallet } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import AdminAccessManager from './AdminAccessManager';
import { SupportModeBanner } from './SupportModeBanner';
import { FeatureLockDot, UpgradeNudgeModal, type FeatureLockedInfo } from './admin/LockedFeature';
import { trpc } from "@/lib/trpc";

// `areas`: staff só vê o item se tiver pelo menos uma dessas áreas liberadas
// (admin sempre vê tudo — auth.me devolve a lista inteira pra ele, ver
// server/routers.ts). Sem `areas` = item básico, disponível pra qualquer
// staff (pedidos/mesas) OU sensível o bastante pra nunca ser liberado por
// permissão (`adminOnly`, ex.: Pix/plano/configuração).
const menuItems: { icon: typeof LayoutDashboard; label: string; path: string; featureId?: string; hiddenInSupportMode?: boolean; areas?: StaffPermissionArea[]; adminOnly?: boolean }[] = [
  { icon: LayoutDashboard, label: "Visão geral", path: "/admin", areas: ["reports"] },
  { icon: ClipboardList, label: "Pedidos", path: "/admin/pedidos" },
  { icon: MapPinned, label: "Rotas de entrega", path: "/admin/rotas", areas: ["deliveryRoutes"] },
  { icon: UtensilsCrossed, label: "Cardápio", path: "/admin/cardapio", areas: ["catalog", "promotions"] },
  { icon: LayoutGrid, label: "Mesas", path: "/admin/mesas", featureId: "tables_qr" },
  { icon: Users, label: "Clientes", path: "/admin/clientes", areas: ["customers"] },
  { icon: BarChart3, label: "Relatórios", path: "/admin/relatorios", areas: ["reports"] },
  // Sempre admin-only, nunca liberável por permissão de staff — a tela existe
  // pra dono acompanhar a EQUIPE, não pra equipe se auto-auditar (ver
  // server/routers/admin/audit.ts).
  { icon: History, label: "Auditoria", path: "/admin/auditoria", adminOnly: true },
  // Pix/gateways de pagamento ficam de fora do Modo Suporte mesmo com
  // escrita liberada no resto — ver server/_core/trpc.ts::adminOnlyProcedure.
  { icon: Wallet, label: "Conta", path: "/admin/conta", hiddenInSupportMode: true, adminOnly: true },
  { icon: FileText, label: "Fiscal", path: "/admin/fiscal", featureId: "fiscal", hiddenInSupportMode: true, adminOnly: true },
  { icon: CalendarDays, label: "Eventos", path: "/admin/eventos", featureId: "events", areas: ["events"] },
  { icon: Settings2, label: "Configuração", path: "/admin/configuracao", adminOnly: true },
  { icon: CreditCard, label: "Meu plano", path: "/admin/plano", adminOnly: true },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, logout } = useAuth();
  // `user` é uma união (login real | sessão de suporte impersonando um
  // admin) — `viaSupportSession` só existe no segundo caso (ver
  // server/routers.ts::auth.me). A faixa precisa ficar FORA do
  // SidebarProvider abaixo (que é um flex row) — dentro dele, o `sticky`
  // do banner fica espremido na coluna da sidebar em vez de ocupar a
  // largura inteira no topo.
  const supportInfo = user && "viaSupportSession" in user && user.viaSupportSession
    ? { restaurantName: user.supportRestaurantName, platformAdminEmail: user.email, expiresAt: user.supportExpiresAt }
    : null;

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
                    Acesse o painel do restaurante
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Entre com sua conta administrativa para operar o MM System Creator.
            </p>
          </div>
          <p className="w-full rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            Abra a tela de acesso da equipe e use uma credencial local cadastrada pelo administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {supportInfo ? <SupportModeBanner session={supportInfo} onExit={logout} exiting={loading} /> : null}
      <SidebarProvider
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
          } as CSSProperties
        }
      >
        <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
          {children}
        </DashboardLayoutContent>
      </SidebarProvider>
    </>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  // `user` é uma união (login real | sessão de suporte impersonando um
  // admin) — `viaSupportSession` só existe no segundo caso, daí o `in`
  // em vez de acesso direto (ver server/routers.ts::auth.me).
  const supportInfo = user && "viaSupportSession" in user && user.viaSupportSession
    ? { restaurantName: user.supportRestaurantName, platformAdminEmail: user.email, expiresAt: user.supportExpiresAt }
    : null;
  const isAdmin = user?.role === "admin";
  const permissions = user?.permissions ?? [];
  const visibleMenuItems = menuItems
    .filter(item => !supportInfo || !item.hiddenInSupportMode)
    .filter(item => !item.adminOnly || isAdmin)
    .filter(item => !item.areas || isAdmin || item.areas.some(area => permissions.includes(area)));
  const settings = trpc.catalog.settings.useQuery();
  const license = trpc.admin.mySnapshot.useQuery(undefined, { staleTime: 60_000 });
  const lockedFeatureIds = new Set(Object.keys(license.data?.lockedFeatures ?? {}));
  const [lockInfo, setLockInfo] = useState<FeatureLockedInfo | null>(null);
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-[#dfcfbb] bg-[#fffaf3] shadow-[10px_0_28px_rgba(60,38,20,.08)]"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-[#eadfce] bg-[#fffdf8]">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#e1d0bb] bg-white text-[#554235] shadow-sm transition-colors hover:bg-[#f2e3d4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d] shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <img src={settings.data?.logoUrl || "/mm-logo-icon.png"} alt="Logotipo MM System Creator" className="h-10 w-10 shrink-0 object-contain" />
                    <span className="font-display font-semibold tracking-tight truncate">MM System Creator</span>
                    <a href="/" target="_blank" rel="noopener noreferrer" className="ml-auto flex shrink-0 items-center gap-1 rounded-lg border border-[#e1d0bb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#613b2a] shadow-sm transition-colors hover:bg-[#f2e3d4]" title="Abrir o site de pedidos">
                      <ExternalLink className="h-3.5 w-3.5" />Ver site
                    </a>
                </div>
              ) : (
                <a href="/" target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#e1d0bb] bg-white text-[#613b2a] shadow-sm transition-colors hover:bg-[#f2e3d4]" title="Abrir o site de pedidos">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="space-y-1 px-3 py-4">
              {visibleMenuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 rounded-xl border px-3 font-semibold transition-all ${isActive ? "border-[#8d3927] bg-[#3a241b] text-[#fff9ef] shadow-[0_5px_14px_rgba(58,36,27,.22)] hover:bg-[#4a2d22] hover:text-white" : "border-transparent bg-transparent text-[#49372b] hover:border-[#e2d0bb] hover:bg-[#f2e3d4] hover:text-[#2c1b14]"}`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-[#f1c582]" : "text-[#8d6955]"}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.featureId && lockedFeatureIds.has(item.featureId) ? (
                        <FeatureLockDot
                          onClick={() => setLockInfo({ featureId: item.featureId!, ...license.data!.lockedFeatures[item.featureId!]! })}
                        />
                      ) : null}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-[#eadfce] bg-[#fffdf8] p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition-colors hover:border-[#e2d0bb] hover:bg-[#f2e3d4] group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d]">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
              </DropdownMenu>
              <div className="mt-2 border-t border-[#eadfce] pt-2">
                {user?.role === "admin" && !supportInfo ? <AdminAccessManager collapsed={isCollapsed} /> : null}
              </div>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Painel"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
      <UpgradeNudgeModal open={Boolean(lockInfo)} onOpenChange={open => { if (!open) setLockInfo(null); }} info={lockInfo} />
    </>
  );
}
