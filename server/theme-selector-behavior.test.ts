// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../client/src/contexts/ThemeContext";
import { ThemeSwitcher } from "../client/src/pages/Home";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = "";
});

describe("seletor de tema da vitrine", () => {
  it("alterna o tema pelo clique e persiste a escolha", () => {
    render(React.createElement(ThemeProvider, { defaultTheme: "light", switchable: true }, React.createElement(ThemeSwitcher)));

    const lightButton = screen.getByRole("button", { name: /Claro/ });
    const darkButton = screen.getByRole("button", { name: /Escuro/ });
    expect(lightButton.getAttribute("aria-pressed")).toBe("true");
    expect(darkButton.getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("theme")).toBe("light");

    fireEvent.click(darkButton);

    expect(darkButton.getAttribute("aria-pressed")).toBe("true");
    expect(lightButton.getAttribute("aria-pressed")).toBe("false");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem("theme")).toBe("dark");

    fireEvent.click(lightButton);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem("theme")).toBe("light");
  });

  it("restaura o tema escuro salvo ao montar novamente", () => {
    window.localStorage.setItem("theme", "dark");
    render(React.createElement(ThemeProvider, { defaultTheme: "light", switchable: true }, React.createElement(ThemeSwitcher)));

    expect(screen.getByRole("button", { name: /Escuro/ }).getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
