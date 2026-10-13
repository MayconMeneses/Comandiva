import { lazy, Suspense } from "react";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { track } from "./lib/track";
import NotFound from "./pages/NotFound";
// Site comercial: o código mora na pasta irmã "Site comercial" e é copiado pra
// client/src/site-comercial por scripts/sync-site-comercial.mjs (roda antes de dev/build/check/test).
import { comercialRoutes } from "./site-comercial/routes";

// Painel Master (equipe interna) e site comercial (qualquer visitante)
// carregados sob demanda, cada um separado do outro — sem isso, todo
// visitante do site comercial baixava também o bundle inteiro do Painel
// Master (Dashboard/RestaurantList/AuditLog/etc.), e vice-versa. Mesmo
// padrão já usado no app principal (client/src/App.tsx).
const Aparencia = lazy(() => import("./pages/Aparencia"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Login = lazy(() => import("./pages/Login"));
const Manutencao = lazy(() => import("./pages/Manutencao"));
const Plans = lazy(() => import("./pages/Plans"));
const Seguranca = lazy(() => import("./pages/Seguranca"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const RestaurantList = lazy(() => import("./pages/RestaurantList"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
    </div>
  );
}

export default function App() {
  const [location] = useLocation();
  // Visita agregada e anônima por rota do site comercial (ver lib/track.ts).
  useEffect(() => {
    if (location.startsWith("/comercial")) track("page_view");
  }, [location]);

  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        {/* Site comercial público — sem PanelLayout, sem sessão de admin.
            Caminhos isolados sob /comercial pra nunca colidir com as rotas do
            Painel Master abaixo (que continuam exatamente como eram). */}
        {comercialRoutes.map(route => (
          <Route key={route.path} path={route.path} component={route.component} />
        ))}

        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route path="/restaurantes" component={RestaurantList} />
        <Route path="/restaurantes/:id" component={RestaurantDetail} />
        <Route path="/planos" component={Plans} />
        <Route path="/auditoria" component={AuditLog} />
        <Route path="/equipe" component={Equipe} />
        <Route path="/manutencao" component={Manutencao} />
        <Route path="/aparencia" component={Aparencia} />
        <Route path="/seguranca" component={Seguranca} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
