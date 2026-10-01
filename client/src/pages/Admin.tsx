import DashboardLayout from "@/components/DashboardLayout";
import DeliveryRoutesManager from "@/components/DeliveryRoutesManager";
import OrderManagement from "@/components/OrderManagement";
import EventManager from "@/components/EventManager";
import AccountAdmin from "@/components/admin/AccountAdmin";
import AuditLog from "@/components/admin/AuditLog";
import FiscalSettings from "@/components/admin/FiscalSettings";
import CatalogAdmin from "@/components/admin/CatalogAdmin";
import Customers from "@/components/admin/Customers";
import Overview from "@/components/admin/Overview";
import Receipt from "@/components/admin/Receipt";
import ReportsByPeriod from "@/components/admin/ReportsByPeriod";
import { Loading } from "@/components/admin/shared";
import PlanAdmin from "@/components/admin/PlanAdmin";
import PwaInstallAdmin from "@/components/admin/PwaInstallAdmin";
import SiteConfig from "@/components/admin/SiteConfig";
import TablesAdmin from "@/components/admin/TablesAdmin";
import TeamLoginCard from "@/components/TeamLoginCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

function AdminContent() {
  const [location] = useLocation();
  const { user } = useAuth();
  const page = useMemo(() => location.split("/")[2] ?? "", [location]);
  const viaSupportSession = Boolean(user && "viaSupportSession" in user && user.viaSupportSession);
  if (page === "pedidos") return <OrderManagement />;
  if (page === "rotas") return <DeliveryRoutesManager />;
  if (page === "cardapio") return <CatalogAdmin />;
  if (page === "mesas") return <TablesAdmin />;
  if (page === "clientes") return <Customers />;
  if (page === "relatorios") return <ReportsByPeriod />;
  if (page === "auditoria") return <AuditLog />;
  if (page === "fiscal") return viaSupportSession ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">Configuração fiscal não fica disponível em Modo Suporte.</div> : <FiscalSettings />;
  if (page === "conta") return viaSupportSession ? <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">Pix e gateways de pagamento não ficam disponíveis em Modo Suporte.</div> : <AccountAdmin />;
  if (page === "eventos") return <EventManager />;
  if (page === "configuracao") return <SiteConfig />;
  if (page === "plano") return <PlanAdmin />;
  if (page === "instalador") return <PwaInstallAdmin />;
  // Página raiz (Visão geral) precisa da permissão "reports" (tem receita do
  // restaurante) — uma conta staff liberada só pra outra área (ex.: só
  // Cardápio) cai em Pedidos em vez de esbarrar num erro de permissão aqui.
  const canSeeOverview = user?.role === "admin" || Boolean(user?.permissions?.includes("reports"));
  return canSeeOverview ? <Overview /> : <OrderManagement />;
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  if (loading) return <Loading />;
  if (!user) return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="flex w-full max-w-md flex-col items-center"><img src="/mm-logo-icon.png" alt="MM System Creator" className="h-14 w-14 object-contain" /><div className="mt-6 w-full"><TeamLoginCard title="Painel do restaurante" subtitle="Entre com a conta do responsável para gerenciar o MM System Creator." /></div><a href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="h-3.5 w-3.5" />Voltar para o site</a></div></div>;
  const isReceiptRoute = location.startsWith("/admin/comprovante/");
  // Comprovante é feito pra imprimir — nunca precisa do menu/sidebar do
  // painel (DashboardLayout), pra NENHUM papel. Antes só staff sem permissão
  // extra pulava o DashboardLayout aqui; um admin (ou staff com permissão
  // extra) imprimindo caía no `return` de baixo com o layout completo, e o
  // menu lateral saía junto na impressão (DashboardLayout não tem CSS de
  // impressão pra se esconder) — reportado pelo usuário com foto. A própria
  // Receipt.tsx já tem seu botão "Voltar aos pedidos" (print:hidden), então
  // o layout nunca fazia falta aqui pra nenhum papel.
  if (isReceiptRoute) return <div className="mx-auto max-w-7xl p-2 sm:p-5"><Receipt /></div>;
  // Staff só entra no painel de verdade se tiver pelo menos uma área extra
  // liberada (ver shared/permissions.ts) — sem nenhuma, continua exatamente
  // como sempre foi: só a rota de comprovante (já tratada acima), resto do
  // trabalho operacional é em /painel-pedidos.
  const hasAnyExtraPermission = user.role === "staff" && (user.permissions?.length ?? 0) > 0;
  if (user.role !== "admin" && !hasAnyExtraPermission) {
    return <div className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><img src="/mm-logo-icon.png" alt="MM System Creator" className="mx-auto h-14 w-14 object-contain" /><Settings2 className="mx-auto mt-5 h-10 w-10 text-primary" /><h1 className="mt-5 font-display text-3xl font-bold">Acesso administrativo necessário</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Esta conta está autenticada, mas ainda não possui permissão de administrador para operar o restaurante.</p></div></div>;
  }
  return <DashboardLayout><div className="mx-auto max-w-7xl p-2 sm:p-5"><AdminContent /></div></DashboardLayout>;
}
