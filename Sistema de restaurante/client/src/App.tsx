import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import About from "@/pages/About";
import Checkout from "@/pages/Checkout";
import FAQ from "@/pages/FAQ";
import Home from "@/pages/Home";
import NotFound from "@/pages/NotFound";
import OrderTracking from "@/pages/OrderTracking";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import PendingOrderBanner from "@/components/PendingOrderBanner";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { PwaInstallProvider } from "./contexts/PwaInstallContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Telas de uso exclusivo da equipe (admin/operação/QR Code de mesa/handoff de
// suporte) — carregadas sob demanda pra não entrarem no bundle que todo
// visitante do cardápio público baixa ao abrir "/".
const Admin = lazy(() => import("@/pages/Admin"));
const RestaurantOrders = lazy(() => import("@/pages/RestaurantOrders"));
const Kitchen = lazy(() => import("@/pages/Kitchen"));
const TableSession = lazy(() => import("@/pages/TableSession"));
const SupportEntry = lazy(() => import("@/pages/SupportEntry"));
const DataRights = lazy(() => import("@/pages/DataRights"));

function RouteFallback() {
  return <div className="grid min-h-screen place-items-center"><Spinner className="size-8" /></div>;
}

function Router() {
  return <Suspense fallback={<RouteFallback />}><Switch><Route path="/" component={Home} /><Route path="/checkout" component={Checkout} /><Route path="/acompanhar" component={OrderTracking} /><Route path="/sobre" component={About} /><Route path="/faq" component={FAQ} /><Route path="/politica-de-privacidade" component={PrivacyPolicy} /><Route path="/termos-de-uso" component={TermsOfUse} /><Route path="/meus-dados" component={DataRights} /><Route path="/painel-pedidos" component={RestaurantOrders} /><Route path="/cozinha" component={Kitchen} /><Route path="/mesa/:token" component={TableSession} /><Route path="/suporte/entrar" component={SupportEntry} /><Route path="/admin" component={Admin} /><Route path="/admin/pedidos" component={Admin} /><Route path="/admin/rotas" component={Admin} /><Route path="/admin/comprovante/:id" component={Admin} /><Route path="/admin/cardapio" component={Admin} /><Route path="/admin/mesas" component={Admin} /><Route path="/admin/clientes" component={Admin} /><Route path="/admin/relatorios" component={Admin} /><Route path="/admin/auditoria" component={Admin} /><Route path="/admin/conta" component={Admin} /><Route path="/admin/eventos" component={Admin} /><Route path="/admin/configuracao" component={Admin} /><Route path="/admin/plano" component={Admin} /><Route path="/admin/instalador" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></Suspense>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><CartProvider><PwaInstallProvider><Toaster /><PendingOrderBanner /><Router /></PwaInstallProvider></CartProvider></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
