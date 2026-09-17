import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const themeSwitcherSource = readFileSync(new URL("../client/src/components/ThemeSwitcher.tsx", import.meta.url), "utf8");
const categoryRailSource = readFileSync(new URL("../client/src/components/CategoryRail.tsx", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("cartões públicos do cardápio", () => {
  it("oferece escolha persistente entre tema claro e escuro abaixo da marca", () => {
    expect(themeSwitcherSource).toContain("function ThemeSwitcher()");
    expect(themeSwitcherSource).toContain("Tema do site");
    expect(themeSwitcherSource).toContain('aria-pressed={theme === "light"}');
    expect(themeSwitcherSource).toContain('aria-pressed={theme === "dark"}');
    expect(homeSource).toContain("<ThemeSwitcher />");
    expect(appSource).toContain('<ThemeProvider defaultTheme="light" switchable>');
    expect(styleSource).toContain(".mm-theme-option[data-active=\"true\"]");
    expect(styleSource).toContain(".mm-storefront.theme-dark");
  });

  it("usa o logotipo enviado no cabeçalho público", () => {
    expect(homeSource).toContain("/mm-logo-icon.png");
    expect(homeSource).toContain('alt="Logotipo MM System Creator"');
  });

  it("aplica o mesmo contêiner de mídia a cada produto de qualquer categoria", () => {
    expect(categoryRailSource).toContain('className="product-media relative overflow-hidden bg-[#e6d9c7]"');
    expect(styleSource).toContain(".menu-card .product-media");
    expect(styleSource).toContain("height: 7.5rem;");
    expect(styleSource).toContain("object-fit: cover;");
  });
});
