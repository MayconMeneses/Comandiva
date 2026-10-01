import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Bug real reportado ao vivo pelo usuário (2026-10-01): testando o balcão
 * (NewCounterOrder.tsx) com a internet desligada de propósito, o pedido
 * falhou e a tela mostrou o texto cru do erro de rede (tipo "Failed to
 * fetch") — lido como "não dá pra fazer o pedido". Causa: quando as poucas
 * tentativas automáticas (`shouldRetryOrderMutation`) se esgotam SEM a
 * mutation chegar a pausar de verdade (`isRetryingOffline` nunca vira true —
 * `navigator.onLine` nem sempre reflete a conexão real do aparelho), o
 * código antigo (`mutation.error && <p>{mutation.error.message}</p>`)
 * mostrava o erro cru em vez de uma mensagem honesta — mesmo o botão
 * continuando liberado pra tentar de novo manualmente.
 *
 * `MutationErrorNotice` (client/src/components/MutationErrorNotice.tsx,
 * lógica pura em client/src/lib/mutationErrorMessage.ts) resolve isso nos 5
 * pontos onde uma mutation de pedido/rodada/pagamento de comanda mostra seu
 * erro final (depois de `isRetryingOffline` já ter sido checado). Prova via
 * leitura de texto-fonte (mesmo padrão de pending-order-wiring.test.ts) que
 * nenhum desses 5 pontos regrediu pro padrão antigo.
 */
const newCounterOrderSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/NewCounterOrder.tsx"), "utf8");
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const tableSessionSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/TableSession.tsx"), "utf8");
const tableMapManagerSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/TableMapManager.tsx"), "utf8");

describe("MutationErrorNotice — ligado nos 5 pontos de erro final de mutation de pedido/rodada/pagamento", () => {
  it("as 4 telas importam MutationErrorNotice", () => {
    for (const source of [newCounterOrderSource, checkoutSource, tableSessionSource, tableMapManagerSource]) {
      expect(source).toContain('import { MutationErrorNotice } from "@/components/MutationErrorNotice";');
    }
  });

  it("NewCounterOrder.tsx (balcão): createOrder usa MutationErrorNotice, não mais o padrão cru — essa é a tela do bug reportado", () => {
    expect(newCounterOrderSource).toContain('<MutationErrorNotice error={createOrder.error} className="text-sm text-red-700" />');
    expect(newCounterOrderSource).not.toContain("createOrder.error && <p className=\"text-sm text-red-700\">{createOrder.error.message}</p>");
  });

  it("Checkout.tsx: createOrder (criação do pedido em si, não o pagamento) usa MutationErrorNotice", () => {
    expect(checkoutSource).toContain('<MutationErrorNotice error={createOrder.error} className="rounded-xl border border-[#edb8aa] bg-[#fff2ee] px-4 py-3 text-sm text-[#a43720]" />');
  });

  it("TableSession.tsx (mesa via QR): addRound usa MutationErrorNotice", () => {
    expect(tableSessionSource).toContain('<MutationErrorNotice error={addRound.error} className="mt-2 text-xs text-red-700" />');
  });

  it("TableMapManager.tsx (equipe): addRound e recordBillPayment usam MutationErrorNotice", () => {
    expect(tableMapManagerSource).toContain('<MutationErrorNotice error={addRound.error} className="text-xs text-red-700" />');
    expect(tableMapManagerSource).toContain('<MutationErrorNotice error={record.error} className="mt-2 text-xs text-red-700" />');
  });
});
