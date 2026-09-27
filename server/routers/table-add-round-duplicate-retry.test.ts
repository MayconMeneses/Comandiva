import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado de revisão de código: addRoundToTable chamava
 * getOrOpenSessionForTable (abre sessão nova + marca a mesa OCUPADA como
 * efeito colateral) ANTES do dedupe por clientOperationId rodar. Um retry
 * antigo da fila offline do cliente (resposta perdida, reenviado até 5min
 * depois) que chegasse depois de a equipe já ter fechado a comanda reabria
 * e reocupava a mesa antes do dedupe (que só rodava dentro de
 * insertPricedOrder) identificar que era o mesmo pedido de novo. Corrigido:
 * checa duplicata pelo clientOperationId antes de tocar em qualquer
 * sessão/mesa.
 */
const mocks = vi.hoisted(() => ({
  priceOrder: vi.fn(),
  getDb: vi.fn(),
  getOrOpenSessionForTable: vi.fn(),
  getOrCreateWalkInCustomer: vi.fn(),
}));

vi.mock("./order", async importOriginal => ({ ...(await importOriginal<object>()), priceOrder: mocks.priceOrder }));
vi.mock("../db", async importOriginal => ({
  ...(await importOriginal<object>()),
  getDb: mocks.getDb,
  getOrOpenSessionForTable: mocks.getOrOpenSessionForTable,
  getOrCreateWalkInCustomer: mocks.getOrCreateWalkInCustomer,
}));

import { addRoundToTable } from "./table";

function makeFakeDb(existingOrder: { id: number; publicCode: string; tableSessionId: number | null } | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (existingOrder ? [existingOrder] : []),
        }),
      }),
    }),
  };
}

describe("addRoundToTable — retry duplicado nunca reabre/reocupa uma mesa já fechada (achado de revisão)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.priceOrder.mockResolvedValue({ totalCents: 5000, items: [] });
    mocks.getOrCreateWalkInCustomer.mockResolvedValue({ id: 1, name: "Cliente Balcão", phone: "" });
  });

  it("clientOperationId já existe: devolve o pedido antigo sem abrir/reocupar sessão nenhuma", async () => {
    mocks.getDb.mockResolvedValue(makeFakeDb({ id: 10, publicCode: "PX-ABC", tableSessionId: 99 }));

    const result = await addRoundToTable({
      tableId: 5,
      items: [{ productId: 1, quantity: 1, addonOptionIds: [] }],
      historyNote: "teste",
      origin: "QR_CODE",
      clientOperationId: "retry-abc-123",
    });

    expect(result).toEqual({ orderId: 10, code: "PX-ABC", sessionId: 99, totalCents: 5000 });
    expect(mocks.getOrOpenSessionForTable).not.toHaveBeenCalled();
  });

  it("clientOperationId novo (sem duplicata): segue o caminho normal e abre/usa a sessão da mesa", async () => {
    mocks.getDb.mockResolvedValue(makeFakeDb(null));
    mocks.getOrOpenSessionForTable.mockResolvedValue({ id: 42 });

    // Sem mock de insertPricedOrder (é a implementação real) isto exigiria
    // uma transação de banco de verdade — como o ponto deste teste é só
    // provar que o caminho normal AINDA passa por getOrOpenSessionForTable
    // quando não é duplicata, para antes de chegar lá.
    mocks.getDb.mockResolvedValue({
      ...makeFakeDb(null),
      transaction: () => {
        throw new Error("não deveria chegar na transação neste teste");
      },
    });

    await expect(
      addRoundToTable({ tableId: 5, items: [{ productId: 1, quantity: 1, addonOptionIds: [] }], historyNote: "teste", origin: "QR_CODE", clientOperationId: "novo-id-456" }),
    ).rejects.toThrow("não deveria chegar na transação neste teste");

    expect(mocks.getOrOpenSessionForTable).toHaveBeenCalledWith(5);
  });
});
