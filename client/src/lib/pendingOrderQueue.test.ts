// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingOrder,
  isEntryExpired,
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
    payload: { operationId: "op-checkout-1" } as never,
    createdAt: Date.now(),
    itemCount: 2,
    schemaVersion: PENDING_ORDER_SCHEMA_VERSION,
    ...overrides,
  } as PendingQueueEntry;
}

describe("pendingOrderQueue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("isEntryExpired", () => {
    it("dentro da janela: não expirado", () => {
      expect(isEntryExpired({ createdAt: Date.now() - (PENDING_ORDER_WINDOW_MS - 1000) })).toBe(false);
    });
    it("exatamente no limite da janela: não expirado ainda (comparação estrita)", () => {
      const now = Date.now();
      expect(isEntryExpired({ createdAt: now - PENDING_ORDER_WINDOW_MS }, now)).toBe(false);
    });
    it("um milissegundo além da janela: expirado", () => {
      const now = Date.now();
      expect(isEntryExpired({ createdAt: now - PENDING_ORDER_WINDOW_MS - 1 }, now)).toBe(true);
    });
  });

  describe("persistPendingOrder / readValidPendingOrders / clearPendingOrder", () => {
    it("round-trip: persiste e lê de volta a mesma entrada", () => {
      persistPendingOrder(checkoutEntry());
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ type: "order.create", screen: "checkout", itemCount: 2 });
    });

    it("descarta e remove entrada expirada em vez de devolvê-la", () => {
      persistPendingOrder(checkoutEntry({ createdAt: Date.now() - PENDING_ORDER_WINDOW_MS - 5000 }));
      expect(readValidPendingOrders()).toHaveLength(0);
      expect(localStorage.getItem("mm-pending-order:order.create:checkout")).toBeNull();
    });

    it("descarta e remove entrada com schemaVersion divergente", () => {
      persistPendingOrder(checkoutEntry({ schemaVersion: PENDING_ORDER_SCHEMA_VERSION + 1 }));
      expect(readValidPendingOrders()).toHaveLength(0);
      expect(localStorage.getItem("mm-pending-order:order.create:checkout")).toBeNull();
    });

    it("tolera JSON corrompido na chave sem lançar, e limpa a entrada", () => {
      localStorage.setItem("mm-pending-order:order.create:checkout", "{não é json válido");
      expect(() => readValidPendingOrders()).not.toThrow();
      expect(readValidPendingOrders()).toHaveLength(0);
      expect(localStorage.getItem("mm-pending-order:order.create:checkout")).toBeNull();
    });

    it("ignora chaves de outros usos do localStorage (prefixo diferente)", () => {
      localStorage.setItem("outra-coisa-qualquer", JSON.stringify({ x: 1 }));
      persistPendingOrder(checkoutEntry());
      expect(readValidPendingOrders()).toHaveLength(1);
    });

    it("clearPendingOrder remove só a chave do contexto informado", () => {
      persistPendingOrder(checkoutEntry());
      persistPendingOrder(checkoutEntry({ screen: "counter", payload: { operationId: "op-counter-1" } as never }));
      clearPendingOrder({ type: "order.create", screen: "checkout" });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ screen: "counter" });
    });

    it("checkout e balcão (counter) coexistem sem se sobrescrever", () => {
      persistPendingOrder(checkoutEntry());
      persistPendingOrder(checkoutEntry({ screen: "counter", payload: { operationId: "op-counter-1" } as never }));
      expect(readValidPendingOrders()).toHaveLength(2);
    });

    it("duas mesas diferentes (tokens diferentes) coexistem sem se sobrescrever", () => {
      persistPendingOrder({ type: "table.addRound", token: "mesa-a", payload: { token: "mesa-a", items: [], operationId: "op-a" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrder({ type: "table.addRound", token: "mesa-b", payload: { token: "mesa-b", items: [], operationId: "op-b" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(readValidPendingOrders()).toHaveLength(2);
    });
  });

  describe("resumeOrCreateOperationId", () => {
    it("sem pendência salva: gera um id novo", () => {
      const id = resumeOrCreateOperationId({ type: "order.create", screen: "checkout" });
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("com pendência válida salva: reusa o MESMO operationId do payload salvo", () => {
      persistPendingOrder(checkoutEntry({ payload: { operationId: "op-fixo-123" } as never }));
      expect(resumeOrCreateOperationId({ type: "order.create", screen: "checkout" })).toBe("op-fixo-123");
    });

    it("pendência de OUTRO contexto não é reusada", () => {
      persistPendingOrder(checkoutEntry({ payload: { operationId: "op-checkout-so" } as never }));
      const idForCounter = resumeOrCreateOperationId({ type: "order.create", screen: "counter" });
      expect(idForCounter).not.toBe("op-checkout-so");
    });

    it("pendência expirada não é reusada (gera novo id)", () => {
      persistPendingOrder(checkoutEntry({ createdAt: Date.now() - PENDING_ORDER_WINDOW_MS - 5000, payload: { operationId: "op-velho" } as never }));
      expect(resumeOrCreateOperationId({ type: "order.create", screen: "checkout" })).not.toBe("op-velho");
    });
  });
});
