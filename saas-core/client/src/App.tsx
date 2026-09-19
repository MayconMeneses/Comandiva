import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import NotFound from "./pages/NotFound";

// Painel Master (equipe interna) e site comercial (qualquer visitante)
// carregados sob demanda, cada um separado do outro — sem isso, todo
// visitante do site comercial baixava também o bundle inteiro do Painel
// Master (Dashboard/RestaurantList/AuditLog/etc.), e vice-versa. Mesmo
// padrão já usado no app principal (client/src/App.tsx).
const AuditLog = lazy(() => import("./pages/AuditLog"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Equipe = lazy(() => import("./pages/Equipe"));
const Login = lazy(() => import("./pages/Login"));
const Manutencao = lazy(() => import("./pages/Manutencao"));
const Plans = lazy(() => import("./pages/Plans"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const RestaurantList = lazy(() => import("./pages/RestaurantList"));
const ComercialHome = lazy(() => import("./pages/comercial/Home"));
const ComercialPlanos = lazy(() => import("./pages/comercial/Planos"));
const ComercialCadastro = lazy(() => import("./pages/comercial/Cadastro"));
const ComercialSucesso = lazy(() => import("./pages/comercial/Sucesso"));
const ComercialConfirmando = lazy(() => import("./pages/comercial/Confirmando"));
const ComercialCardapio = lazy(() => import("./pages/comercial/Cardapio"));
const ComercialTermos = lazy(() => import("./pages/comercial/Termos"));
const ComercialPrivacidade = lazy(() => import("./pages/comercial/Privacidade"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        {/* Site comercial público — sem PanelLayout, sem sessão de admin.
            Caminhos isolados sob /comercial pra nunca colidir com as rotas do
            Painel Master abaixo (que continuam exatamente como eram). */}
        <Route path="/comercial" component={ComercialHome} />
        <Route path="/comercial/planos" component={ComercialPlanos} />
        <Route path="/comercial/cadastro/sucesso" component={ComercialSucesso} />
        <Route path="/comercial/cadastro/confirmando" component={ComercialConfirmando} />
        <Route path="/comercial/cadastro/cardapio" component={ComercialCardapio} />
        <Route path="/comercial/cadastro/:planKey" component={ComercialCadastro} />
        <Route path="/comercial/termos" component={ComercialTermos} />
        <Route path="/comercial/privacidade" component={ComercialPrivacidade} />

        <Route path="/login" component={Login} />
        <Route path="/" component={Dashboard} />
        <Route path="/restaurantes" component={RestaurantList} />
        <Route path="/restaurantes/:id" component={RestaurantDetail} />
        <Route path="/planos" component={Plans} />
        <Route path="/auditoria" component={AuditLog} />
        <Route path="/equipe" component={Equipe} />
        <Route path="/manutencao" component={Manutencao} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
