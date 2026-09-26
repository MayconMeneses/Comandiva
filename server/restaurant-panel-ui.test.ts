// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { OrderStatusActions } from "../client/src/components/OrderManagement";
import { advanceOrderStatus, getNextOrderStatus } from "../client/src/lib/orderStatus";

const { mutateMock } = vi.hoisted(() => ({ mutateMock: vi.fn() }));
vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { orders: { invalidate: vi.fn() }, dashboard: { invalidate: vi.fn() } } }),
    admin: { updateOrderStatus: { useMutation: () => ({ isPending: false, error: null, mutate: mutateMock }) } },
  },
}));
vi.mock("../client/src/lib/deviceId", () => ({ getDeviceId: () => "device-test-123" }));

const restaurantPanelSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/RestaurantOrders.tsx"), "utf8");
const orderManagementSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/OrderManagement.tsx"), "utf8");
const checkoutSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Checkout.tsx"), "utf8");
const appSource = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");

describe("operações do restaurante", () => {
  it("oferece uma fila separada com as etapas operacionais essenciais", () => {
    expect(restaurantPanelSource).toContain('"Aceitar pedido"');
    expect(restaurantPanelSource).toContain('"Iniciar produção"');
    expect(restaurantPanelSource).toContain('"Enviar para entrega"');
    expect(restaurantPanelSource).toContain("Acessos da equipe");
    expect(appSource).toContain('path="/painel-pedidos"');
  });

  it("expõe ações diretas para todas as próximas etapas na aba Pedidos", () => {
    expect(orderManagementSource).toContain('status === "PENDING"');
    expect(orderManagementSource).toContain("getNextOrderStatus(order)");
    expect(orderManagementSource).toContain("trpc.admin.updateOrderStatus.useMutation");
    expect(orderManagementSource).toContain("bg-amber-100 text-amber-800");
  });

  it("calcula a próxima etapa correta para delivery e retirada", () => {
    expect(getNextOrderStatus({ status: "PENDING", fulfillmentType: "DELIVERY" })).toEqual({ status: "ACCEPTED", label: "Aceitar pedido" });
    expect(getNextOrderStatus({ status: "ACCEPTED", fulfillmentType: "DELIVERY" })).toEqual({ status: "PREPARING", label: "Iniciar preparo" });
    expect(getNextOrderStatus({ status: "PREPARING", fulfillmentType: "DELIVERY" })).toEqual({ status: "OUT_FOR_DELIVERY", label: "Enviar para entrega" });
    expect(getNextOrderStatus({ status: "PREPARING", fulfillmentType: "PICKUP" })).toEqual({ status: "READY_FOR_PICKUP", label: "Pronto para retirada" });
    expect(getNextOrderStatus({ status: "OUT_FOR_DELIVERY", fulfillmentType: "DELIVERY" })).toEqual({ status: "COMPLETED", label: "Concluir entrega" });
    expect(getNextOrderStatus({ status: "COMPLETED", fulfillmentType: "DELIVERY" })).toBeNull();
  });

  it("dispara a mutation com o pedido, o próximo status e o expectedStatus (proteção de conflito) ao acionar o botão", () => {
    const updates: Array<{ orderId: number; status: string; expectedStatus: string }> = [];
    advanceOrderStatus({ id: 42, status: "PREPARING", fulfillmentType: "DELIVERY" }, input => updates.push(input));
    expect(updates).toEqual([{ orderId: 42, status: "OUT_FOR_DELIVERY", expectedStatus: "PREPARING" }]);
    advanceOrderStatus({ id: 43, status: "COMPLETED", fulfillmentType: "DELIVERY" }, input => updates.push(input));
    expect(updates).toHaveLength(1);
  });

  it("aciona a mutation ao clicar no botão da aba Pedidos, mandando expectedStatus e deviceId", () => {
    mutateMock.mockClear();
    render(createElement(OrderStatusActions, { order: { id: 77, status: "PENDING", fulfillmentType: "DELIVERY" } }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar pedido/i }));
    expect(mutateMock).toHaveBeenCalledWith({ orderId: 77, status: "ACCEPTED", expectedStatus: "PENDING", deviceId: "device-test-123" });
  });

  it("identifica visualmente o cliente já localizado pelo telefone no checkout", () => {
    expect(checkoutSource).toContain("Encontramos o cadastro de");
    expect(checkoutSource).toContain("Telefone cadastrado:");
  });
});
