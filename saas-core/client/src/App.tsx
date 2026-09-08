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

export default function App() {
  return (
    <Switch>
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
