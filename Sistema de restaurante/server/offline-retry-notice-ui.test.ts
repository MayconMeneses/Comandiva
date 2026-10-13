// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineRetryNotice } from "../client/src/components/OfflineRetryNotice";

/**
 * React Query 5.90.2 não suporta cancelar uma mutation pausada de verdade
 * (ver comentário em OfflineRetryNotice.tsx, confirmado lendo query-core/src/
 * mutation.ts: reset() só desanexa o observer, a Mutation/Retryer internos
 * continuam esperando a internet voltar e disparam sozinhos quando isso
 * acontecer). Recarregar a página é a única saída realmente segura — este
 * teste prova que o botão certo (não um "cancelar" que mentiria) está
 * presente e chama window.location.reload(), não outra coisa.
 *
 * Reportado ao vivo pelo dono do produto (2026-09-30): testando o app
 * instalado 100% offline, ficou preso em "Tentando de novo…" sem conseguir
 * nem fazer outro pedido pela mesma tela.
 */
describe("OfflineRetryNotice", () => {
  afterEach(() => cleanup());

  it("mostra o aviso de queda breve (não stale) e o botão de recarregar", () => {
    render(createElement(OfflineRetryNotice, { stale: false }));
    expect(screen.getByText(/Sem conexão\. Tentando enviar de novo sozinho/)).toBeTruthy();
    expect(screen.getByText(/Esse pedido já está salvo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar página" })).toBeTruthy();
  });

  it("mostra o aviso de conexão perdida há muito tempo quando stale", () => {
    render(createElement(OfflineRetryNotice, { stale: true }));
    expect(screen.getByText(/Conexão perdida há muito tempo — os preços podem ter mudado\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recarregar página" })).toBeTruthy();
  });

  it("clicar em \"Recarregar página\" chama window.location.reload() — a única forma comprovadamente segura de abandonar uma tentativa presa", () => {
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload: reloadMock } });
    try {
      render(createElement(OfflineRetryNotice, { stale: false }));
      fireEvent.click(screen.getByRole("button", { name: "Recarregar página" }));
      expect(reloadMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });
});
