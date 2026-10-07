import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fase 4 do offline-first (ver "Frente 3" do plano em
 * C:\Users\maico\.claude\plans\lovely-purring-dusk.md) — Pix/cartão online
 * (Mercado Pago) genuinamente não funciona sem
 * internet, isso é arquitetural. O que a Fase 4 corrige é só a UX: ficar
 * ÓBVIO e HONESTO quando isso acontece, em vez de silêncio ou texto cru de
 * erro. Checkout.tsx/OrderTracking.tsx não são splitados em
 * subcomponentes pequenos o bastante pra valer montar via React Testing
 * Library (mesmo raciocínio de custo/ganho de pending-order-wiring.test.ts/
 * restaurant-panel-ui.test.ts) — prova via leitura de texto-fonte.
 */
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const orderTrackingSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/OrderTracking.tsx"), "utf8");

describe("Fase 4 — UX honesta pra pagamento online offline", () => {
  it("Checkout.tsx: erro final de pagamento lê createCardPayment.error OU createPixPayment.error — bug real onde um Pix que falha de vez não mostrava nada (as duas mutations são mutuamente exclusivas por forma de pagamento)", () => {
    expect(checkoutSource).toContain("(createCardPayment.error ?? createPixPayment.error) && <p");
    expect(checkoutSource).toContain("{(createCardPayment.error ?? createPixPayment.error)?.message} O pedido já foi registrado");
  });

  it("OrderTracking.tsx: erro de rede na query de acompanhamento mostra linguagem honesta de offline em vez do texto cru do tRPC", () => {
    expect(orderTrackingSource).toContain('import { isNetworkError } from "@/lib/offlineRetry";');
    expect(orderTrackingSource).toContain("isNetworkError(query.error) ? \"Sem conexão — a página atualiza sozinha assim que a internet voltar.\" : query.error.message");
  });
});
