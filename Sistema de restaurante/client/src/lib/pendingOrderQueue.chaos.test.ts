// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingOrder,
  PENDING_ORDER_SCHEMA_VERSION,
  PENDING_ORDER_WINDOW_MS,
  persistPendingOrder,
  readValidPendingOrders,
  resumeOrCreateOperationId,
  type PendingQueueEntry,
} from "./pendingOrderQueue";

function checkoutEntry(overrides: Partial<PendingQueueEntry> = {}): PendingQueueEntry {
  return {
    type: "order.create",
    screen: "checkout",
    payload: { operationId: "op-1" } as never,
    createdAt: Date.now(),
    itemCount: 2,
    schemaVersion: PENDING_ORDER_SCHEMA_VERSION,
    ...overrides,
  } as PendingQueueEntry;
}

describe("pendingOrderQueue — cenários adversos (timelines de múltiplos eventos)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("submissão → falha de negócio (onSettled limpa) → resubmit não reusa o id antigo, já encerrado", () => {
    persistPendingOrder(checkoutEntry({ payload: { operationId: "op-velho-encerrado" } as never }));
    // onSettled do onError roda synchronamente pro caso de negócio — simula isso aqui.
    clearPendingOrder({ type: "order.create", screen: "checkout" });

    const nextId = resumeOrCreateOperationId({ type: "order.create", screen: "checkout" });
    expect(nextId).not.toBe("op-velho-encerrado");
    expect(readValidPendingOrders()).toHaveLength(0);
  });

  it("duas persistências seguidas pro MESMO contexto (slot único): a segunda sobrescreve a primeira, sem duplicar chave nem lançar", () => {
    persistPendingOrder(checkoutEntry({ payload: { operationId: "op-tentativa-1" } as never, itemCount: 2 }));
    expect(() => persistPendingOrder(checkoutEntry({ payload: { operationId: "op-tentativa-2" } as never, itemCount: 5 }))).not.toThrow();

    const found = readValidPendingOrders();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ itemCount: 5 });
    expect((found[0].payload as { operationId: string }).operationId).toBe("op-tentativa-2");
  });

  it("mistura de entradas válidas e expiradas: expiração de uma não contamina a leitura das outras", () => {
    persistPendingOrder(checkoutEntry({ payload: { operationId: "op-checkout-valida" } as never }));
    persistPendingOrder({ type: "table.addRound", token: "mesa-a-expirada", payload: { token: "mesa-a-expirada", items: [], operationId: "op-mesa-a" } as never, createdAt: Date.now() - PENDING_ORDER_WINDOW_MS - 10_000, itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
    persistPendingOrder({ type: "table.addRound", token: "mesa-b-valida", payload: { token: "mesa-b-valida", items: [], operationId: "op-mesa-b" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });

    const found = readValidPendingOrders();
    expect(found).toHaveLength(2);
    expect(found.some(entry => entry.type === "table.addRound" && entry.token === "mesa-a-expirada")).toBe(false);
    // Efeito colateral esperado: a expirada foi removida do localStorage, não só ignorada.
    expect(localStorage.getItem("mm-pending-order:table.addRound:mesa-a-expirada")).toBeNull();
    // As duas válidas continuam no disco.
    expect(localStorage.getItem("mm-pending-order:order.create:checkout")).not.toBeNull();
    expect(localStorage.getItem("mm-pending-order:table.addRound:mesa-b-valida")).not.toBeNull();
  });

  it("localStorage.setItem lançando (quota excedida/modo privado antigo): persistPendingOrder não lança, só não persiste", () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError", "QuotaExceededError");
    });

    expect(() => persistPendingOrder(checkoutEntry())).not.toThrow();
    expect(readValidPendingOrders()).toHaveLength(0);

    setItemSpy.mockRestore();
  });

  it("localStorage.getItem/length lançando na leitura: readValidPendingOrders não lança, devolve lista vazia", () => {
    persistPendingOrder(checkoutEntry());
    const lengthSpy = vi.spyOn(Storage.prototype, "length", "get").mockImplementation(() => {
      throw new Error("acesso negado ao storage");
    });

    expect(() => readValidPendingOrders()).not.toThrow();
    expect(readValidPendingOrders()).toEqual([]);

    lengthSpy.mockRestore();
  });

  it("entrada com payload sem operationId (corrompida de outra forma): nunca devolve undefined, gera um id novo de verdade", () => {
    // isEntryValid não checa a FORMA do payload além de existir — um payload malformado
    // (ex.: localStorage editado manualmente) não deveria derrubar a leitura da fila, e
    // MUITO menos vazar um operationId undefined (isso quebraria a validação Zod do
    // servidor pra toda submissão futura até a página recarregar).
    localStorage.setItem("mm-pending-order:order.create:checkout", JSON.stringify({ type: "order.create", screen: "checkout", payload: {}, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION }));
    const id = resumeOrCreateOperationId({ type: "order.create", screen: "checkout" });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});
