// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppearanceSettings from "../client/src/components/admin/AppearanceSettings";

/**
 * Verifica de ponta a ponta, no DOM (sem precisar de backend/DB real — não
 * havia um ambiente local disponível pra clicar no navegador de verdade
 * contra o app completo), a reclamação original que motivou essa feature:
 * escolher uma cor de fundo livre precisa mudar o FUNDO de verdade (não só
 * um acento), com texto/superfície derivados automaticamente — e o
 * comportamento de trava de plano (custom_theme) continua intacto.
 */
const mocks = vi.hoisted(() => ({ updateSettings: vi.fn() }));
let mockLockedFeatures: Record<string, { requiredPlanKey: string; requiredPlanName: string }> = {};

vi.mock("../client/src/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { dashboard: { invalidate: vi.fn() } }, catalog: { settings: { invalidate: vi.fn() } } }),
    admin: {
      mySnapshot: { useQuery: () => ({ data: { lockedFeatures: mockLockedFeatures } }) },
      updateSettings: { useMutation: (opts?: { onSuccess?: () => void }) => ({ isPending: false, error: null, mutate: (input: unknown) => { mocks.updateSettings(input); opts?.onSuccess?.(); } }) },
    },
  },
}));

// O preview ao vivo é aplicado via requestAnimationFrame (no máximo 1
// recálculo por frame, ver AppearanceSettings.tsx) — precisa esperar um
// frame antes de checar as CSS variables, senão a asserção roda antes do
// callback agendado.
const flushRaf = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const BASE_SETTINGS = {
  isAcceptingOrders: true,
  deliveryFeeCents: 500,
  minimumOrderCents: 1000,
  estimatedDeliveryMin: 30,
  estimatedDeliveryMax: 50,
  openingHours: "18h às 23h",
  colorTheme: "classico",
  customBackgroundColor: null as string | null,
};

afterEach(() => {
  cleanup();
  mockLockedFeatures = {};
  mocks.updateSettings.mockClear();
  document.documentElement.style.cssText = "";
});

describe("AppearanceSettings — plano SEM custom_theme", () => {
  it("mostra os 7 presets com cadeado e o bloco de cor livre travado (LockedFeatureCard)", () => {
    mockLockedFeatures = { custom_theme: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } };
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    // Rótulo da seção E o título do LockedFeatureCard usam o mesmo texto — as duas ocorrências provam que o card travado renderizou.
    expect(screen.getAllByText("Cor de fundo personalizada")).toHaveLength(2);
    expect(screen.getByText(/Disponível a partir do plano/)).toBeTruthy();
    expect(screen.queryByLabelText("Selecionar cor de fundo")).toBeNull();
  });

  it("clicar num preset pago abre o convite de upgrade, sem trocar o tema", () => {
    mockLockedFeatures = { custom_theme: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } };
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    fireEvent.click(screen.getByRole("button", { name: "Azul Profissional" }));
    expect(screen.getByText("Recurso do plano Profissional")).toBeTruthy();
  });
});

describe("AppearanceSettings — plano COM custom_theme: fundo livre muda o fundo de verdade", () => {
  it("escolher uma cor de fundo escura muda --background/--foreground/--card/--border juntos, não só um acento", async () => {
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    const hexInput = screen.getByPlaceholderText("#0b1220");

    fireEvent.change(hexInput, { target: { value: "#080b16" } });
    await flushRaf();

    const root = document.documentElement.style;
    expect(root.getPropertyValue("--background")).toBe("#080b16");
    // texto claro (contraste correto pro fundo escuro escolhido)
    const foreground = root.getPropertyValue("--foreground");
    expect(foreground.toLowerCase()).not.toBe("#231d18"); // não é mais o texto escuro padrão
    // card/popover/secondary/muted/border TAMBÉM mudaram — não é só background isolado
    expect(root.getPropertyValue("--card")).not.toBe("");
    expect(root.getPropertyValue("--card")).not.toBe("#fffdf8");
    expect(root.getPropertyValue("--border")).not.toBe("");
    expect(root.getPropertyValue("--border")).not.toBe("#ded3c4");
    // --primary não muda — cor de marca fica fora do motor, de propósito
    expect(root.getPropertyValue("--primary")).toBe("#b4472d");
  });

  it("\"Restaurar padrão\" some depois de escolher uma cor e volta ao fundo pastel do preset selecionado", async () => {
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    expect(screen.queryByRole("button", { name: "Restaurar padrão" })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("#0b1220"), { target: { value: "#080b16" } });
    await flushRaf();
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#080b16");
    expect(screen.getByRole("button", { name: "Restaurar padrão" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrão" }));
    await flushRaf();
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#f6f1e8"); // background do "classico"
    expect(screen.queryByRole("button", { name: "Restaurar padrão" })).toBeNull();
  });

  it("clicar em Salvar envia colorTheme + customBackgroundColor junto com os campos obrigatórios da configuração", () => {
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    fireEvent.change(screen.getByPlaceholderText("#0b1220"), { target: { value: "#0b1220" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar aparência" }));
    expect(mocks.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      isAcceptingOrders: true,
      deliveryFeeCents: 500,
      colorTheme: "classico",
      customBackgroundColor: "#0b1220",
    }));
  });

  it("trocar de preset (Verde Esmeralda) muda o fundo pro pastel daquele tema, sem cor customizada", async () => {
    render(createElement(AppearanceSettings, { settings: BASE_SETTINGS }));
    fireEvent.click(screen.getByRole("button", { name: "Verde Esmeralda" }));
    await flushRaf();
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#eaf6f0");
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#047857");
  });
});
