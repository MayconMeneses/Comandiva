import { lazy, type ComponentType } from "react";
import "./comercial.css";

/**
 * Tabela de rotas do site comercial (mmsystem.tech/comercial/*). O Master
 * (pasta ../Master) só lê esta lista e monta as <Route> — assim todo o site
 * comercial (páginas, rotas e CSS) mora nesta pasta, e o App do Master não
 * precisa conhecer cada página.
 *
 * Carregamento sob demanda (lazy): visitante do site comercial não baixa o
 * bundle do Painel Master e vice-versa.
 *
 * Os caminhos ficam isolados sob /comercial pra nunca colidir com as rotas do
 * Painel Master. A ORDEM importa: rotas mais específicas antes de
 * /comercial/cadastro/:planKey e do curinga /comercial/:rest*.
 */
const Home = lazy(() => import("./pages/Home"));
const Planos = lazy(() => import("./pages/Planos"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Sucesso = lazy(() => import("./pages/Sucesso"));
const Confirmando = lazy(() => import("./pages/Confirmando"));
const Cardapio = lazy(() => import("./pages/Cardapio"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const comercialRoutes: ReadonlyArray<{ path: string; component: ComponentType }> = [
  { path: "/comercial", component: Home },
  { path: "/comercial/planos", component: Planos },
  { path: "/comercial/cadastro/sucesso", component: Sucesso },
  { path: "/comercial/cadastro/confirmando", component: Confirmando },
  { path: "/comercial/cadastro/cardapio", component: Cardapio },
  { path: "/comercial/cadastro/:planKey", component: Cadastro },
  { path: "/comercial/termos", component: Termos },
  { path: "/comercial/privacidade", component: Privacidade },
  { path: "/comercial/:rest*", component: NotFound },
];
