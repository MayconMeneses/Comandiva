import { Route, Switch } from "wouter";
import AuditLog from "./pages/AuditLog";
import Dashboard from "./pages/Dashboard";
import Equipe from "./pages/Equipe";
import Login from "./pages/Login";
import Manutencao from "./pages/Manutencao";
import NotFound from "./pages/NotFound";
import Plans from "./pages/Plans";
import RestaurantDetail from "./pages/RestaurantDetail";
import RestaurantList from "./pages/RestaurantList";
import ComercialHome from "./pages/comercial/Home";
import ComercialPlanos from "./pages/comercial/Planos";
import ComercialCadastro from "./pages/comercial/Cadastro";
import ComercialSucesso from "./pages/comercial/Sucesso";
import ComercialConfirmando from "./pages/comercial/Confirmando";

export default function App() {
  return (
    <Switch>
      {/* Site comercial público — sem PanelLayout, sem sessão de admin.
          Caminhos isolados sob /comercial pra nunca colidir com as rotas do
          Painel Master abaixo (que continuam exatamente como eram). */}
      <Route path="/comercial" component={ComercialHome} />
      <Route path="/comercial/planos" component={ComercialPlanos} />
      <Route path="/comercial/cadastro/sucesso" component={ComercialSucesso} />
      <Route path="/comercial/cadastro/confirmando" component={ComercialConfirmando} />
      <Route path="/comercial/cadastro/:planKey" component={ComercialCadastro} />

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
  );
}
