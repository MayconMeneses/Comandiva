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
 * persistente de pedido pendente, ver client/src/lib/pendingOrderQueue.ts)
 * está de fato ligada nas 3 telas, não só que o módulo em si funciona
 * isoladamente (isso já é coberto por pendingOrderQueue.test.ts).
 */
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const counterSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/NewCounterOrder.tsx"), "utf8");
const tableSessionSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/TableSession.tsx"), "utf8");
const appSource = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");

describe("Fase 3 completa — fila de pedido pendente ligada nas telas certas", () => {
  it("Checkout.tsx: onMutate persiste com screen \"checkout\", onSettled limpa", () => {
    expect(checkoutSource).toMatch(/onMutate:\s*variables\s*=>\s*persistPendingOrder\(\{[^}]*screen:\s*"checkout"/);
    expect(checkoutSource).toContain('onSettled: () => clearPendingOrder({ type: "order.create", screen: "checkout" })');
  });

  it("Checkout.tsx: a semente do operationIdRef usa resumeOrCreateOperationId, não generateClientId direto", () => {
    expect(checkoutSource).toContain('useRef(resumeOrCreateOperationId({ type: "order.create", screen: "checkout" }))');
    // generateClientId ainda é usado, mas só dentro do onSuccess (regenerar pro PRÓXIMO pedido) — não como semente do useRef.
    expect(checkoutSource).not.toContain("useRef(generateClientId())");
  });

  it("NewCounterOrder.tsx: onMutate persiste com screen \"counter\", onSettled limpa", () => {
    expect(counterSource).toMatch(/onMutate:\s*variables\s*=>\s*persistPendingOrder\(\{[^}]*screen:\s*"counter"/);
    expect(counterSource).toContain('onSettled: () => clearPendingOrder({ type: "order.create", screen: "counter" })');
  });

  it("NewCounterOrder.tsx: a semente do operationIdRef usa resumeOrCreateOperationId", () => {
    expect(counterSource).toContain('useRef(resumeOrCreateOperationId({ type: "order.create", screen: "counter" }))');
    expect(counterSource).not.toContain("useRef(generateClientId())");
  });

  it("TableSession.tsx: onMutate persiste com type \"table.addRound\" e o token da mesa, onSettled limpa", () => {
    expect(tableSessionSource).toMatch(/onMutate:\s*variables\s*=>\s*persistPendingOrder\(\{\s*type:\s*"table\.addRound",\s*token,/);
    expect(tableSessionSource).toContain('onSettled: () => clearPendingOrder({ type: "table.addRound", token })');
  });

  it("TableSession.tsx: a semente do operationIdRef usa resumeOrCreateOperationId com o token", () => {
    expect(tableSessionSource).toContain('useRef(resumeOrCreateOperationId({ type: "table.addRound", token }))');
    expect(tableSessionSource).not.toContain("useRef(generateClientId())");
  });

  it("App.tsx: PendingOrderBanner está montado (fora do gate de admin do PwaInstallButton)", () => {
    expect(appSource).toContain("<PendingOrderBanner />");
    // Precisa estar ANTES do <Router/> pra funcionar em qualquer rota, e dentro do CartProvider é irrelevante — só confirma presença no JSX raiz.
    expect(appSource).toMatch(/<Toaster \/><PendingOrderBanner \/>/);
  });
});
