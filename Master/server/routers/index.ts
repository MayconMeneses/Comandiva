import { router } from "../_core/trpc";
import { billingRouter } from "./billing";
import { restaurantsRouter } from "./restaurants";
import { plansRouter } from "./plans";
import { subscriptionsRouter } from "./subscriptions";
import { syncRouter } from "./sync";
import { masterPanelRouter } from "./masterPanel";
import { supportRouter } from "./support";
import { publicRouter } from "./public";

// Aninhado (não mergeRouters) porque cada arquivo é um namespace distinto
// por natureza (sync.mySnapshot vs restaurants.create) — igual ao
// server/routers.ts da raiz do app principal aninha catalog/order/table/admin.
// `restaurants`/`plans`/`subscriptions` continuam gateados por operatorProcedure
// (scripts/CLI); `masterPanel.*` é a UI nova, gateada por platformAdminProcedure —
// namespaces separados de propósito, pra auditoria sempre saber se quem agiu
// foi um script com token ou um Super Admin logado.
export const appRouter = router({
  restaurants: restaurantsRouter,
  plans: plansRouter,
  subscriptions: subscriptionsRouter,
  sync: syncRouter,
  billing: billingRouter,
  masterPanel: masterPanelRouter,
  support: supportRouter,
  // Único namespace sem gate (token de operador / API key / sessão de admin) —
  // ver server/routers/public.ts para o porquê de ficar isolado dos demais.
  public: publicRouter,
});

export type AppRouter = typeof appRouter;
