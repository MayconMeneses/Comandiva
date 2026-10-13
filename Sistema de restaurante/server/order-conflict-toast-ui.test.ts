// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prova o comportamento novo do onError de updateOrderStatus em OrderCard
 * (RestaurantOrders.tsx), QueueCard (Kitchen.tsx), OrderStatusActions
 * (OrderManagement.tsx, /admin e /admin/pedidos) e OrderActions
 * (OrdersTable.tsx, Visão Geral): um erro CONFLICT (outro dispositivo já
 * mudou o pedido — ver updateOrderStatus, server/routers/admin/orders.ts)
 * precisa virar um toast específico, não só o texto de erro genérico — nos
 * dois primeiros o card desmonta assim que o snapshot invalida (o pedido
 * muda de coluna/sai do filtro da fila), então só o toast sobrevive pra
 * pessoa realmente ver a mensagem; nos outros dois a lista não é filtrada
 * por status, mas a mesma proteção (expectedStatus/deviceId/toast) foi
 * estendida por consistência — são as duas outras telas que também mexem
 * no mesmo `orders` e podem estar abertas em outro dispositivo da equipe.
 */
const { invalidateMock, mutateMocks, toastErrorMock } = vi.hoisted(() => ({
  invalidateMock: vi.fn(),
  mutateMocks: { current: null as null | ((input: unknown, opts?: { onSuccess?: () => void; onError?: () => void }) => void) },
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: toastErrorMock, success: vi.fn() } }));

// Captura o `onError` que CADA componente passa pro useMutation — o teste
// simula o servidor chamando esse callback com um erro no formato real do
// tRPC (TRPCError com `data.code`), sem precisar de rede/mock de servidor.
let capturedOnError: ((error: { message: string; data?: { code?: string } }) => void) | undefined;
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { operationalSnapshot: { invalidate: invalidateMock }, orders: { invalidate: invalidateMock }, dashboard: { invalidate: invalidateMock } } }),
    admin: {
      updateOrderStatus: {
        useMutation: (opts: { onSuccess?: () => void; onError?: (error: { message: string; data?: { code?: string } }) => void }) => {
          capturedOnError = opts.onError;
          return { isPending: false, isPaused: false, failureCount: 0, error: null, mutate: (input: unknown) => mutateMocks.current?.(input) };
        },
      },
    },
    // offlineResilienceEnabled fica false (settings.data undefined) — este
    // teste prova só o toast/payload, não o retry offline (ver
    // offline-resilience-ui.test.ts pra isso).
    catalog: { settings: { useQuery: () => ({ data: undefined }) } },
  },
}));
vi.mock("@/lib/deviceId", () => ({ getDeviceId: () => "device-test-123" }));

import { OrderCard } from "../client/src/pages/RestaurantOrders";
import { QueueCard } from "../client/src/pages/Kitchen";
import { OrderStatusActions } from "../client/src/components/OrderManagement";
import { OrderActions } from "../client/src/components/admin/OrdersTable";

const BASE_ORDER = { id: 1, publicCode: "PX-TEST01", customerName: "Cliente Teste", customerPhone: "85999990000", fulfillmentType: "PICKUP" as const, origin: "SITE", tableLabel: null, status: "PENDING", totalCents: 1000, createdAt: Date.now(), acceptedAt: null, preparingAt: null, customerNote: null, items: [{ id: 1, productName: "Produto", quantity: 1, note: null }] };

describe("toast de conflito em updateOrderStatus (painel da equipe)", () => {
  beforeEach(() => { vi.clearAllMocks(); capturedOnError = undefined; mutateMocks.current = null; });
  afterEach(() => cleanup());

  it("OrderCard (RestaurantOrders.tsx): erro CONFLICT mostra o toast específico, não o genérico", () => {
    render(createElement(OrderCard, { order: BASE_ORDER }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(capturedOnError).toBeTypeOf("function");

    capturedOnError!({ message: "erro genérico qualquer", data: { code: "CONFLICT" } });
    expect(invalidateMock).toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente.");
  });

  it("OrderCard: erro que NÃO é CONFLICT não mostra o toast de conflito", () => {
    render(createElement(OrderCard, { order: BASE_ORDER }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));

    capturedOnError!({ message: "Banco de dados indisponível", data: { code: "INTERNAL_SERVER_ERROR" } });
    expect(invalidateMock).toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("QueueCard (Kitchen.tsx): erro CONFLICT mostra o mesmo toast específico", () => {
    render(createElement(QueueCard, { order: { ...BASE_ORDER, status: "ACCEPTED" }, position: 1 }));
    fireEvent.click(screen.getByRole("button", { name: /Iniciar produção/i }));
    expect(capturedOnError).toBeTypeOf("function");

    capturedOnError!({ message: "erro genérico qualquer", data: { code: "CONFLICT" } });
    expect(invalidateMock).toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente.");
  });

  it("advance()/next() mandam expectedStatus e deviceId na mutation, não só orderId/status", () => {
    mutateMocks.current = vi.fn();
    render(createElement(OrderCard, { order: BASE_ORDER }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(mutateMocks.current).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, status: "ACCEPTED", expectedStatus: "PENDING", deviceId: "device-test-123" }));
  });

  it("OrderStatusActions (OrderManagement.tsx, /admin/pedidos): erro CONFLICT mostra o mesmo toast específico", () => {
    render(createElement(OrderStatusActions, { order: { id: 1, status: "PENDING", fulfillmentType: "PICKUP" } }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(capturedOnError).toBeTypeOf("function");

    capturedOnError!({ message: "erro genérico qualquer", data: { code: "CONFLICT" } });
    expect(invalidateMock).toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente.");
  });

  it("OrderStatusActions: manda expectedStatus e deviceId na mutation", () => {
    mutateMocks.current = vi.fn();
    render(createElement(OrderStatusActions, { order: { id: 1, status: "PENDING", fulfillmentType: "PICKUP" } }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(mutateMocks.current).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, status: "ACCEPTED", expectedStatus: "PENDING", deviceId: "device-test-123" }));
  });

  it("OrderActions (OrdersTable.tsx, Visão Geral): erro CONFLICT mostra o mesmo toast específico", () => {
    render(createElement(OrderActions, { order: { id: 1, status: "PENDING", fulfillmentType: "PICKUP" } }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(capturedOnError).toBeTypeOf("function");

    capturedOnError!({ message: "erro genérico qualquer", data: { code: "CONFLICT" } });
    expect(invalidateMock).toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Esse pedido já foi atualizado — a tela foi atualizada com o status mais recente.");
  });

  it("OrderActions: manda expectedStatus e deviceId tanto no botão de ação quanto no Cancelar", () => {
    mutateMocks.current = vi.fn();
    render(createElement(OrderActions, { order: { id: 1, status: "PREPARING", fulfillmentType: "DELIVERY" } }));
    fireEvent.click(screen.getByRole("button", { name: /Saiu para entrega/i }));
    expect(mutateMocks.current).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, status: "OUT_FOR_DELIVERY", expectedStatus: "PREPARING", deviceId: "device-test-123" }));

    mutateMocks.current = vi.fn();
    fireEvent.click(screen.getByText("Cancelar"));
    expect(mutateMocks.current).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1, status: "CANCELLED", expectedStatus: "PREPARING", deviceId: "device-test-123" }));
  });
});
