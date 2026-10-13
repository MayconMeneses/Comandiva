// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pedido do Maycon: tirar o "Instalar app" do botão flutuante global (visto
 * por qualquer visitante do cardápio público que fosse admin logado) e virar
 * uma aba própria na barra lateral do Admin ("Instalador do app", logo abaixo
 * de "Meu plano"), liberada também pra staff — não só admin, já que quem
 * atende mesa/balcão também se beneficia de instalar o app.
 *
 * Cuidado técnico (por que a escuta do evento NÃO está neste teste nem no
 * componente visível): `beforeinstallprompt` só dispara UMA vez por sessão,
 * sob critério do navegador — por isso a captura continua montada cedo/
 * globalmente em App.tsx (PwaInstallProvider), fora do Router, e a UI em
 * PwaInstallAdmin.tsx só CONSOME esse estado via usePwaInstall(). Simular o
 * evento de verdade em teste teria pouco valor (é um detalhe do navegador,
 * não da nossa lógica) — o que importa provar aqui é ONDE a UI aparece e
 * QUEM vê, mesmo raciocínio de custo/ganho já usado em
 * restaurant-panel-ui.test.ts pras páginas grandes.
 */
const appSource = readFileSync(resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(import.meta.dirname, "../client/src/components/DashboardLayout.tsx"), "utf8");
const adminSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Admin.tsx"), "utf8");

describe("Instalador do app — colocação na barra lateral, não mais botão flutuante", () => {
  it("App.tsx: PwaInstallProvider envolve o Router (escuta beforeinstallprompt cedo, em toda rota) e não existe mais PwaInstallButton", () => {
    expect(appSource).not.toContain("PwaInstallButton");
    expect(appSource).toMatch(/<PwaInstallProvider>[\s\S]*<Router \/>[\s\S]*<\/PwaInstallProvider>/);
    expect(appSource).toContain('<Route path="/admin/instalador" component={Admin} />');
  });

  it("DashboardLayout.tsx: 'Instalador do app' aparece DEPOIS de 'Meu plano' na lista de itens, sem adminOnly nem areas (visível pra staff também)", () => {
    const planoIndex = dashboardSource.indexOf('label: "Meu plano"');
    const installerIndex = dashboardSource.indexOf('label: "Instalador do app"');
    expect(planoIndex).toBeGreaterThan(-1);
    expect(installerIndex).toBeGreaterThan(planoIndex);

    // Cada item de menuItems é um objeto de uma linha só — o primeiro "}"
    // depois do label fecha exatamente esse item (nenhum item tem chave
    // aninhada), diferente de tentar achar o fim do array inteiro (que tem
    // "[]" na própria anotação de tipo, ambíguo pra um indexOf simples).
    const installerLineStart = dashboardSource.lastIndexOf("{", installerIndex);
    const installerLineEnd = dashboardSource.indexOf("}", installerIndex);
    const installerLine = dashboardSource.slice(installerLineStart, installerLineEnd);
    expect(installerLine).toContain('path: "/admin/instalador"');
    expect(installerLine).not.toContain("adminOnly");
    expect(installerLine).not.toContain("areas:");
  });

  it("Admin.tsx: rota /admin/instalador (page === \"instalador\") renderiza PwaInstallAdmin", () => {
    expect(adminSource).toContain('if (page === "instalador") return <PwaInstallAdmin />;');
  });
});

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { admin: { mySnapshot: { useQuery: mockUseQuery } } },
}));

const { mockInstall, mockPwaState } = vi.hoisted(() => ({
  mockInstall: vi.fn().mockResolvedValue("accepted"),
  mockPwaState: { current: { canInstall: false, isStandalone: false } },
}));
vi.mock("@/contexts/PwaInstallContext", () => ({
  usePwaInstall: () => ({ ...mockPwaState.current, install: mockInstall }),
}));

import PwaInstallAdmin from "../client/src/components/admin/PwaInstallAdmin";

describe("PwaInstallAdmin — os 3 estados da tela", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: { lockedFeatures: {} } });
  });
  afterEach(() => cleanup());

  it("já instalado (isStandalone): mostra confirmação, sem botão de instalar", () => {
    mockPwaState.current = { canInstall: false, isStandalone: true };
    mockUseQuery.mockReturnValue({ data: { lockedFeatures: {} } });
    render(createElement(PwaInstallAdmin));
    expect(screen.getByText(/já está rodando o app instalado/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Instalar app/i })).toBeNull();
  });

  it("navegador ainda não liberou o prompt (canInstall=false, não instalado): mostra explicação, sem botão", () => {
    mockPwaState.current = { canInstall: false, isStandalone: false };
    mockUseQuery.mockReturnValue({ data: { lockedFeatures: {} } });
    render(createElement(PwaInstallAdmin));
    expect(screen.getByText(/ainda não liberou a instalação/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Instalar app/i })).toBeNull();
  });

  it("navegador liberou (canInstall=true), plano SEM team_app bloqueado: clicar chama install() direto", async () => {
    mockPwaState.current = { canInstall: true, isStandalone: false };
    mockUseQuery.mockReturnValue({ data: { lockedFeatures: {} } });
    render(createElement(PwaInstallAdmin));
    const button = screen.getByRole("button", { name: /Instalar app/i });
    button.click();
    await Promise.resolve();
    expect(mockInstall).toHaveBeenCalledTimes(1);
  });

  it("navegador liberou, mas team_app está bloqueado pelo plano: clicar NÃO chama install(), abre o convite de upgrade", async () => {
    mockPwaState.current = { canInstall: true, isStandalone: false };
    mockUseQuery.mockReturnValue({ data: { lockedFeatures: { team_app: { requiredPlanKey: "profissional", requiredPlanName: "Profissional" } } } });
    render(createElement(PwaInstallAdmin));
    const button = screen.getByRole("button", { name: /Instalar app/i });
    button.click();
    await Promise.resolve();
    expect(mockInstall).not.toHaveBeenCalled();
    expect(screen.getByText(/Profissional/)).toBeTruthy();
  });
});
