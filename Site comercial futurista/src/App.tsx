import { Suspense, lazy, useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { Route, Switch, useLocation } from "wouter";
import { Preloader } from "./components/Preloader";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import Home from "./pages/Home";
const Planos = lazy(() => import("./pages/Planos"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Sucesso = lazy(() => import("./pages/Sucesso"));
const Cardapio = lazy(() => import("./pages/Cardapio"));
const Confirmando = lazy(() => import("./pages/Confirmando"));
const Termos = lazy(() => import("./pages/Termos"));
const Privacidade = lazy(() => import("./pages/Privacidade"));
import { track } from "./lib/track";
import { scrollToTarget } from "./lib/scroll";

/** Ao trocar de página, volta ao topo (ou vai até a âncora, ex.: /#por-dentro). */
function useScrollOnNavigate() {
  const [location] = useLocation();
  useEffect(() => {
    track("page_view", location);
    const hash = window.location.hash;
    if (hash) requestAnimationFrame(() => scrollToTarget(hash));
    else scrollToTarget(0, true);
  }, [location]);
}

export default function App() {
  // O hero só começa a animar depois que o preloader sai da frente.
  const [ready, setReady] = useState(false);
  useScrollOnNavigate();

  return (
    // reducedMotion="user": quem pede menos movimento no sistema vê tudo sem animação de posição.
    <MotionConfig reducedMotion="user">
      <Preloader onDone={() => setReady(true)} />
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent-strong focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <Suspense fallback={<div className="min-h-[100dvh]" />}>
        <Switch>
          <Route path="/">
            <Home ready={ready} />
          </Route>
          <Route path="/planos" component={Planos} />
          <Route path="/termos" component={Termos} />
          <Route path="/privacidade" component={Privacidade} />
          {/* A ordem importa: rotas fixas antes de /cadastro/:planKey */}
          <Route path="/cadastro/sucesso" component={Sucesso} />
          <Route path="/cadastro/cardapio" component={Cardapio} />
          <Route path="/cadastro/confirmando" component={Confirmando} />
          <Route path="/cadastro/:planKey" component={Cadastro} />
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </main>
      <Footer />
    </MotionConfig>
  );
}
