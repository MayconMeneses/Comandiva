import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
const accessManagerSource = readFileSync(new URL("../client/src/components/AdminAccessManager.tsx", import.meta.url), "utf8");
const uploadSource = readFileSync(new URL("../client/src/components/ProductCreateWithImage.tsx", import.meta.url), "utf8");
const adminSource = readFileSync(new URL("../client/src/components/admin/CatalogAdmin.tsx", import.meta.url), "utf8");

describe("mídia de produtos e navegação administrativa", () => {
  it("mantém os estados de navegação com contraste explícito", () => {
    expect(sidebarSource).toContain("bg-[#3a241b]");
    expect(sidebarSource).toContain("bg-[#fffaf3]");
  });

  it("usa o logotipo enviado no cabeçalho administrativo", () => {
    expect(sidebarSource).toContain("/pubx-logo.svg");
    expect(sidebarSource).toContain('alt="Logotipo MM System Creator"');
  });

  it("mantém a barra de gestão de acessos no painel principal", () => {
    expect(sidebarSource).toContain("AdminAccessManager");
    expect(sidebarSource).toContain('user?.role === "admin"');
    expect(accessManagerSource).toContain("Acessos administrativos");
    expect(accessManagerSource).toContain('value="admin"');
    expect(accessManagerSource).toContain("Administradores podem acessar e alterar clientes");
  });

  it("aceita upload de formatos de imagem com limite alto", () => {
    expect(uploadSource).toContain("20_000_000");
    expect(uploadSource).toContain("image/avif");
    expect(uploadSource).toContain("Opção 1 — URL da imagem");
    expect(uploadSource).toContain("Opção 2 — Enviar arquivo");
    expect(uploadSource).toContain("setForm(current => ({ ...current, imageUrl: data.url }))");
    expect(adminSource).toContain("<ProductCreateWithImage />");
    expect(adminSource).not.toContain("<MenuManager />");
  });
});
