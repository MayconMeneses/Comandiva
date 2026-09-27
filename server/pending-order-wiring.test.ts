import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Checkout.tsx/NewCounterOrder.tsx/TableSession.tsx não são splitados em
 * subcomponentes pequenos (ao contrário de OrderCard/OrderActions), então
 * montar as páginas inteiras via React Testing Library exigiria mockar 6+
 * queries por página — mesmo raciocínio de custo/ganho que já levou
 * server/restaurant-panel-ui.test.ts a testar Checkout.tsx via leitura de
 * texto-fonte em vez de render. Prova que a Fase 3 completa (fila
 * persistente de pedido pendente, ver client/src/lib/pendingOrderQueue.ts) e
 * o teto de tempo do retry em memória (ver client/src/hooks/
 * useStaleRetryWarning.ts) estão de fato ligados nas 3 telas, não só que os
 * módulos em si funcionam isolados (isso já é coberto pelos testes próprios
 * de cada um).
 */
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const counterSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/NewCounterOrder.tsx"), "utf8");
const tableSessionSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/TableSession.tsx"), "utf8");
const appSource = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");

const STALE_MESSAGE = "Conexão perdida há muito tempo — os preços podem ter mudado. Recarregue a página antes de continuar.";

describe("Fase 3 completa — fila de pedido pendente ligada nas telas certas", () => {
  it("Checkout.tsx: onMutate persiste com screen \"checkout\" (só quando offlineResilienceEnabled), onSettled limpa", () => {
    expect(checkoutSource).toMatch(/onMutate:\s*variables\s*=>\s*\{[^}]*persistPendingOrder\(\{[^}]*screen:\s*"checkout"/s);
    expect(checkoutSource).toContain('onSettled: () => { startedAtRef.current = null; if (offlineResilienceEnabled) clearPendingOrder({ type: "order.create", screen: "checkout" }); }');
  });

  it("Checkout.tsx: a semente do operationIdRef usa useResumableOperationId (achado de revisão: useRef direto nunca via resumeOrCreateOperationId, porque offlineResilienceEnabled sempre chega undefined/false na 1ª renderização)", () => {
    expect(checkoutSource).toContain('import { useResumableOperationId } from "@/hooks/useResumableOperationId";');
    expect(checkoutSource).toContain('useResumableOperationId({ type: "order.create", screen: "checkout" }, settings.data === undefined ? undefined : offlineResilienceEnabled)');
  });

  it("NewCounterOrder.tsx: onMutate persiste com screen \"counter\" (só quando offlineResilienceEnabled), onSettled limpa", () => {
    expect(counterSource).toMatch(/onMutate:\s*variables\s*=>\s*\{[^}]*persistPendingOrder\(\{[^}]*screen:\s*"counter"/s);
    expect(counterSource).toContain('onSettled: () => { startedAtRef.current = null; if (offlineResilienceEnabled) clearPendingOrder({ type: "order.create", screen: "counter" }); }');
  });

  it("NewCounterOrder.tsx: a semente do operationIdRef usa useResumableOperationId", () => {
    expect(counterSource).toContain('import { useResumableOperationId } from "@/hooks/useResumableOperationId";');
    expect(counterSource).toContain('useResumableOperationId({ type: "order.create", screen: "counter" }, settings.data === undefined ? undefined : offlineResilienceEnabled)');
  });

  it("TableSession.tsx: onMutate persiste com type \"table.addRound\" e o token da mesa (só quando offlineResilienceEnabled), onSettled limpa", () => {
    expect(tableSessionSource).toMatch(/onMutate:\s*variables\s*=>\s*\{[^}]*persistPendingOrder\(\{\s*type:\s*"table\.addRound",\s*token,/s);
    expect(tableSessionSource).toContain('onSettled: () => { startedAtRef.current = null; if (offlineResilienceEnabled) clearPendingOrder({ type: "table.addRound", token }); }');
  });

  it("TableSession.tsx: a semente do operationIdRef usa useResumableOperationId com o token", () => {
    expect(tableSessionSource).toContain('import { useResumableOperationId } from "@/hooks/useResumableOperationId";');
    expect(tableSessionSource).toContain('useResumableOperationId({ type: "table.addRound", token }, settings.data === undefined ? undefined : offlineResilienceEnabled)');
  });

  it("App.tsx: PendingOrderBanner está montado logo após o Toaster, antes do Router (em qualquer rota)", () => {
    expect(appSource).toContain("<PendingOrderBanner />");
    // Precisa estar ANTES do <Router/> pra funcionar em qualquer rota, e dentro do CartProvider é irrelevante — só confirma presença no JSX raiz.
    expect(appSource).toMatch(/<Toaster \/><PendingOrderBanner \/>/);
  });

  describe("teto de tempo do retry em memória (item residual da Fase 3 estrita)", () => {
    it("as 3 telas capturam startedAtRef no onMutate e limpam (null) no onSettled", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toMatch(/const startedAtRef = useRef<number \| null>\(null\);/);
        expect(source).toMatch(/startedAtRef\.current = now;/);
        expect(source).toMatch(/onSettled: \(\) => \{ startedAtRef\.current = null;/);
      }
    });

    it("as 3 telas usam useStaleRetryWarning importado do hook certo", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toContain('import { useStaleRetryWarning } from "@/hooks/useStaleRetryWarning";');
        expect(source).toMatch(/useStaleRetryWarning\(isRetryingOffline\((createOrder|addRound)\), startedAtRef\.current\)/);
      }
    });

    it("as 3 telas mostram a mensagem de conexão perdida há muito tempo quando stale", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toContain(STALE_MESSAGE);
      }
    });

    it("as 3 telas trocam o toast/mensagem de sucesso quando a confirmação demorou mais que PENDING_ORDER_WINDOW_MS", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toContain("PENDING_ORDER_WINDOW_MS");
        expect(source).toMatch(/queda de conexão longa/);
      }
    });
  });

  describe("offline_resilience é recurso de plano (Profissional+, 2026-09-24)", () => {
    it("as 3 telas derivam offlineResilienceEnabled de catalog.settings", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toMatch(/const offlineResilienceEnabled = Boolean\(settings\.data\?\.offlineResilienceEnabled\);/);
      }
    });

    it("as 3 telas usam offlineResilienceMutationOptions em vez de retry/retryDelay fixos", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toContain("offlineResilienceMutationOptions(offlineResilienceEnabled)");
      }
    });

    it("as 3 telas só persistem a fila pendente (onMutate) quando offlineResilienceEnabled", () => {
      for (const source of [checkoutSource, counterSource, tableSessionSource]) {
        expect(source).toMatch(/if \(!offlineResilienceEnabled\) return;/);
      }
    });
  });
});
