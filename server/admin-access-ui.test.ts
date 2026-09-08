// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import AdminAccessManager from "../client/src/components/AdminAccessManager";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), update: vi.fn(), setActive: vi.fn(), remove: vi.fn(),
  accounts: [
    { id: 1, userId: 1, name: "ADM principal", username: "principal", role: "admin", active: true, createdAt: Date.now(), lastSignedInAt: null, isOwner: true },
    { id: 2, userId: 2, name: "Admin auxiliar", username: "auxiliar", role: "admin", active: true, createdAt: Date.now(), lastSignedInAt: null, isOwner: false },
  ],
}));

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({}),
    team: {
      list: { useQuery: () => ({ data: mocks.accounts, isLoading: false, error: null, refetch: vi.fn() }) },
      create: { useMutation: () => ({ isPending: false, error: null, mutate: mocks.create }) },
      update: { useMutation: () => ({ isPending: false, error: null, mutate: mocks.update }) },
      setActive: { useMutation: () => ({ isPending: false, error: null, mutate: mocks.setActive }) },
      delete: { useMutation: () => ({ isPending: false, error: null, mutate: mocks.remove }) },
    },
  },
}));

describe("gerenciador de acessos administrativos", () => {
  it("cadastra um novo administrador pelo formulário", () => {
    mocks.create.mockClear();
    render(createElement(AdminAccessManager));
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar acessos administrativos" }));
    fireEvent.change(screen.getByLabelText("Nome da pessoa"), { target: { value: "Novo Administrador" } });
    fireEvent.change(screen.getByLabelText("Usuário de acesso"), { target: { value: "novo.admin" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-segura" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar acesso" }));
    expect(mocks.create).toHaveBeenCalledWith({ name: "Novo Administrador", username: "novo.admin", password: "senha-segura", role: "admin" });
  });

  it("permite editar, pausar e remover uma conta auxiliar", () => {
    mocks.update.mockClear(); mocks.setActive.mockClear(); mocks.remove.mockClear();
    const view = render(createElement(AdminAccessManager));
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar acessos administrativos" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar acesso de Admin auxiliar" }));
    fireEvent.change(screen.getByDisplayValue("Admin auxiliar"), { target: { value: "Admin financeiro" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(mocks.update).toHaveBeenCalledWith({ accountId: 2, name: "Admin financeiro", password: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Pausar acesso de Admin auxiliar" }));
    expect(mocks.setActive).toHaveBeenCalledWith({ accountId: 2, active: false });
    mocks.accounts[1].active = false;
    view.unmount();
    render(createElement(AdminAccessManager));
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar acessos administrativos" }));
    fireEvent.click(screen.getByRole("button", { name: "Reativar acesso de Admin auxiliar" }));
    expect(mocks.setActive).toHaveBeenCalledWith({ accountId: 2, active: true });
    vi.stubGlobal("confirm", vi.fn(() => true));
    fireEvent.click(screen.getByRole("button", { name: "Remover acesso de Admin auxiliar" }));
    expect(mocks.remove).toHaveBeenCalledWith({ accountId: 2 });
  });

  it("protege o administrador principal contra pausa e remoção", () => {
    render(createElement(AdminAccessManager));
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar acessos administrativos" }));
    expect(screen.getByRole("button", { name: "Pausar acesso de ADM principal" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Remover acesso de ADM principal" })).toHaveProperty("disabled", true);
  });
});
