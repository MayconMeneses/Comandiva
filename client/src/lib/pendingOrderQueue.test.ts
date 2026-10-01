// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingOrder,
  isEntryExpired,
  loadPendingOrderDisplay,
  PENDING_ORDER_CHANGE_EVENT,
  PENDING_ORDER_SCHEMA_VERSION,
  PENDING_ORDER_WINDOW_MS,
  persistPendingOrder,
  persistPendingOrderDisplay,
  readValidPendingOrders,
  resumeOrCreateOperationId,
  type PendingQueueEntry,
  type PendingRoundDisplaySnapshot,
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

    it("tolera payload adulterado (não-objeto) sem lançar, e limpa a entrada — regressão: 'operationId' in payload lançava TypeError quando payload era string/número", () => {
      localStorage.setItem("mm-pending-order:admin.recordBillPayment:5", JSON.stringify({ type: "admin.recordBillPayment", tableSessionId: 5, payload: "não é um objeto", createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION }));
      expect(() => readValidPendingOrders()).not.toThrow();
      expect(readValidPendingOrders()).toHaveLength(0);
      expect(localStorage.getItem("mm-pending-order:admin.recordBillPayment:5")).toBeNull();
      expect(() => resumeOrCreateOperationId({ type: "admin.recordBillPayment", tableSessionId: 5 })).not.toThrow();
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

    it("admin.addManualRound (rodada do admin, por tableId): round-trip persiste e lê de volta", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-admin-1" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ type: "admin.addManualRound", tableId: 7 });
    });

    it("mesa via QR Code (token) e a MESMA mesa lançada pelo admin (tableId) coexistem sem colidir — identidades diferentes de propósito", () => {
      persistPendingOrder({ type: "table.addRound", token: "mesa-7-qr", payload: { token: "mesa-7-qr", items: [], operationId: "op-qr" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-admin" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(readValidPendingOrders()).toHaveLength(2);
    });

    it("clearPendingOrder do admin.addManualRound remove só a chave daquela mesa", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-a" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrder({ type: "admin.addManualRound", tableId: 8, payload: { tableId: 8, items: [], operationId: "op-b" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      clearPendingOrder({ type: "admin.addManualRound", tableId: 7 });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ tableId: 8 });
    });

    it("admin.updateOrderStatus (Fase C, por orderId): round-trip persiste e lê de volta", () => {
      persistPendingOrder({ type: "admin.updateOrderStatus", orderId: 42, payload: { orderId: 42, status: "ACCEPTED", expectedStatus: "PENDING" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ type: "admin.updateOrderStatus", orderId: 42 });
    });

    it("clearPendingOrder do admin.updateOrderStatus remove só a chave daquele pedido", () => {
      persistPendingOrder({ type: "admin.updateOrderStatus", orderId: 42, payload: { orderId: 42, status: "ACCEPTED" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrder({ type: "admin.updateOrderStatus", orderId: 43, payload: { orderId: 43, status: "ACCEPTED" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      clearPendingOrder({ type: "admin.updateOrderStatus", orderId: 42 });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ orderId: 43 });
    });

    it("admin.recordBillPayment (Fase C, por tableSessionId): round-trip persiste e lê de volta", () => {
      persistPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 5, payload: { sessionId: 5, method: "PIX", amountCents: 1500, operationId: "op-pay-1" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ type: "admin.recordBillPayment", tableSessionId: 5 });
    });

    it("clearPendingOrder do admin.recordBillPayment remove só a chave daquela comanda", () => {
      persistPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 5, payload: { sessionId: 5, method: "PIX", amountCents: 1500, operationId: "op-a" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 6, payload: { sessionId: 6, method: "PIX", amountCents: 2000, operationId: "op-b" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      clearPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 5 });
      const found = readValidPendingOrders();
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ tableSessionId: 6 });
    });
  });

  describe("persistPendingOrderDisplay / loadPendingOrderDisplay (Fase 2 — cartão otimista)", () => {
    const display = { customerName: "Ana", customerPhone: "85988887777", totalCents: 4500, items: [{ name: "X-Burguer", quantity: 2 }] };

    it("round-trip: persiste e lê de volta o mesmo snapshot de exibição", () => {
      persistPendingOrderDisplay({ type: "order.create", screen: "counter" }, display);
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })).toEqual(display);
    });

    it("sem nada salvo: devolve null", () => {
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })).toBeNull();
    });

    it("clearPendingOrder remove o snapshot de exibição junto com a pendência", () => {
      persistPendingOrder(checkoutEntry({ screen: "counter", payload: { operationId: "op-counter-1" } as never }));
      persistPendingOrderDisplay({ type: "order.create", screen: "counter" }, display);
      clearPendingOrder({ type: "order.create", screen: "counter" });
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })).toBeNull();
    });

    it("checkout e balcão (counter) têm snapshots de exibição independentes", () => {
      persistPendingOrderDisplay({ type: "order.create", screen: "checkout" }, { ...display, customerName: "Cliente do site" });
      persistPendingOrderDisplay({ type: "order.create", screen: "counter" }, display);
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "checkout" })?.customerName).toBe("Cliente do site");
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })?.customerName).toBe("Ana");
    });

    // Regressão encontrada testando a Fase 2 ao vivo (Docker local, 2026-09-30):
    // displayKeyFor() usa o MESMO KEY_PREFIX + sufixo ":display", então
    // readValidPendingOrders() (chamada a cada render por
    // resumeOrCreateOperationId via useRef(...) nas telas) varria essa chave
    // junto, via isEntryValid rejeitava o formato (não é um PendingQueueEntry)
    // e apagava o snapshot de exibição no PRIMEIRO re-render depois de criado
    // — o cartão otimista nunca chegava a aparecer de verdade.
    it("readValidPendingOrders NÃO apaga o snapshot de exibição salvo ao lado (regressão)", () => {
      persistPendingOrder(checkoutEntry({ screen: "counter", payload: { operationId: "op-counter-1" } as never }));
      persistPendingOrderDisplay({ type: "order.create", screen: "counter" }, display);
      readValidPendingOrders();
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })).toEqual(display);
    });
  });

  describe("persistPendingOrderDisplay / loadPendingOrderDisplay genérico (Frente 1 da Fase 2b — cartão otimista de rodada)", () => {
    const roundDisplay: PendingRoundDisplaySnapshot = { tableLabel: "Mesa 7", totalCents: 3200, items: [{ name: "Água", quantity: 2 }] };

    it("table.addRound (mesa via QR Code, por token): round-trip persiste e lê de volta", () => {
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "mesa-7-qr" }, roundDisplay);
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "mesa-7-qr" })).toEqual(roundDisplay);
    });

    it("admin.addManualRound (rodada lançada pela equipe, por tableId): round-trip persiste e lê de volta", () => {
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 }, roundDisplay);
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 })).toEqual(roundDisplay);
    });

    it("table.addRound, admin.addManualRound (mesmo número) e order.create (counter) têm snapshots independentes, sem se sobrescrever", () => {
      const counterDisplay = { customerName: "Ana", customerPhone: "85988887777", totalCents: 4500, items: [{ name: "X-Burguer", quantity: 2 }] };
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "7" }, { ...roundDisplay, tableLabel: "QR Mesa 7" });
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 }, { ...roundDisplay, tableLabel: "Admin Mesa 7" });
      persistPendingOrderDisplay({ type: "order.create", screen: "counter" }, counterDisplay);
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "7" })?.tableLabel).toBe("QR Mesa 7");
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 })?.tableLabel).toBe("Admin Mesa 7");
      expect(loadPendingOrderDisplay({ type: "order.create", screen: "counter" })?.customerName).toBe("Ana");
    });

    it("clearPendingOrder remove o snapshot de exibição da rodada junto com a pendência (table.addRound)", () => {
      persistPendingOrder({ type: "table.addRound", token: "mesa-7-qr", payload: { token: "mesa-7-qr", items: [], operationId: "op-qr" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "mesa-7-qr" }, roundDisplay);
      clearPendingOrder({ type: "table.addRound", token: "mesa-7-qr" });
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "table.addRound", token: "mesa-7-qr" })).toBeNull();
    });

    it("clearPendingOrder remove o snapshot de exibição da rodada junto com a pendência (admin.addManualRound)", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-admin" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 }, roundDisplay);
      clearPendingOrder({ type: "admin.addManualRound", tableId: 7 });
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 })).toBeNull();
    });

    // Mesma regressão já coberta acima pro order.create — confirma que a
    // exclusão de chaves ":display" em readValidPendingOrders() (prefixo +
    // sufixo, sem lista fixa de contextos) também cobre os 2 contextos novos
    // de rodada, sem precisar de nenhuma mudança naquela função.
    it("readValidPendingOrders NÃO apaga o snapshot de exibição da rodada (admin.addManualRound)", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-admin" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      persistPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 }, roundDisplay);
      readValidPendingOrders();
      expect(loadPendingOrderDisplay<PendingRoundDisplaySnapshot>({ type: "admin.addManualRound", tableId: 7 })).toEqual(roundDisplay);
    });
  });

  describe(`evento ${PENDING_ORDER_CHANGE_EVENT} (reatividade entre quem grava e quem exibe)`, () => {
    it("persistPendingOrder dispara o evento", () => {
      const handler = vi.fn();
      window.addEventListener(PENDING_ORDER_CHANGE_EVENT, handler);
      persistPendingOrder(checkoutEntry());
      window.removeEventListener(PENDING_ORDER_CHANGE_EVENT, handler);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("clearPendingOrder dispara o evento", () => {
      persistPendingOrder(checkoutEntry());
      const handler = vi.fn();
      window.addEventListener(PENDING_ORDER_CHANGE_EVENT, handler);
      clearPendingOrder({ type: "order.create", screen: "checkout" });
      window.removeEventListener(PENDING_ORDER_CHANGE_EVENT, handler);
      expect(handler).toHaveBeenCalledTimes(1);
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

    it("admin.addManualRound: reusa o operationId salvo pro MESMO tableId", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-mesa-7" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(resumeOrCreateOperationId({ type: "admin.addManualRound", tableId: 7 })).toBe("op-mesa-7");
    });

    it("admin.addManualRound: NÃO reusa pendência de outra mesa (tableId diferente)", () => {
      persistPendingOrder({ type: "admin.addManualRound", tableId: 7, payload: { tableId: 7, items: [], operationId: "op-mesa-7" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(resumeOrCreateOperationId({ type: "admin.addManualRound", tableId: 8 })).not.toBe("op-mesa-7");
    });

    it("admin.recordBillPayment: reusa o operationId salvo pra MESMA comanda", () => {
      persistPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 5, payload: { sessionId: 5, method: "PIX", amountCents: 1500, operationId: "op-pay-5" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(resumeOrCreateOperationId({ type: "admin.recordBillPayment", tableSessionId: 5 })).toBe("op-pay-5");
    });

    it("admin.recordBillPayment: NÃO reusa pendência de outra comanda (tableSessionId diferente)", () => {
      persistPendingOrder({ type: "admin.recordBillPayment", tableSessionId: 5, payload: { sessionId: 5, method: "PIX", amountCents: 1500, operationId: "op-pay-5" } as never, createdAt: Date.now(), itemCount: 1, schemaVersion: PENDING_ORDER_SCHEMA_VERSION });
      expect(resumeOrCreateOperationId({ type: "admin.recordBillPayment", tableSessionId: 6 })).not.toBe("op-pay-5");
    });
  });
});
