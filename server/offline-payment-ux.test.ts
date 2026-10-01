import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fase 4 do offline-first (ver "Frente 3" do plano em
 * C:\Users\maico\.claude\plans\lovely-purring-dusk.md) — Pix/cartão online
 * (Mercado Pago) e NFC-e (Focus NFe) genuinamente não funcionam sem
 * internet, isso é arquitetural. O que a Fase 4 corrige é só a UX: ficar
 * ÓBVIO e HONESTO quando isso acontece, em vez de silêncio ou texto cru de
 * erro. Checkout.tsx/OrderTracking.tsx/Receipt.tsx não são splitados em
 * subcomponentes pequenos o bastante pra valer montar via React Testing
 * Library (mesmo raciocínio de custo/ganho de pending-order-wiring.test.ts/
 * restaurant-panel-ui.test.ts) — prova via leitura de texto-fonte.
 */
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const orderTrackingSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/OrderTracking.tsx"), "utf8");
const receiptSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/admin/Receipt.tsx"), "utf8");

describe("Fase 4 — UX honesta pra pagamento online/NFC-e offline", () => {
  it("Checkout.tsx: erro final de pagamento lê createCardPayment.error OU createPixPayment.error — bug real onde um Pix que falha de vez não mostrava nada (as duas mutations são mutuamente exclusivas por forma de pagamento)", () => {
    expect(checkoutSource).toContain("(createCardPayment.error ?? createPixPayment.error) && <p");
    expect(checkoutSource).toContain("{(createCardPayment.error ?? createPixPayment.error)?.message} O pedido já foi registrado");
  });

  it("OrderTracking.tsx: erro de rede na query de acompanhamento mostra linguagem honesta de offline em vez do texto cru do tRPC", () => {
    expect(orderTrackingSource).toContain('import { isNetworkError } from "@/lib/offlineRetry";');
    expect(orderTrackingSource).toContain("isNetworkError(query.error) ? \"Sem conexão — a página atualiza sozinha assim que a internet voltar.\" : query.error.message");
  });

  it("Receipt.tsx (DanfeSection): botão 'Tentar emitir nota de novo' não fica mais mudo quando a própria reemissão falha — lê o .error certo (pedido ou mesa) e distingue offline de recusa real", () => {
    expect(receiptSource).toContain('import { isNetworkError } from "@/lib/offlineRetry";');
    expect(receiptSource).toContain("const retryError = isDineIn ? retryTable.error : retryOrder.error;");
    expect(receiptSource).toContain("isNetworkError(retryError) ? \"Sem conexão — não deu pra tentar agora. Tente de novo quando a internet voltar.\" : retryError.message");
  });
});
