import { describe, expect, it } from "vitest";
import { contrastRatio, deriveSurfacePalette } from "./deriveSurfacePalette";

const BLACK = { r: 0, g: 0, b: 0 };
const WHITE = { r: 255, g: 255, b: 255 };

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

describe("contrastRatio", () => {
  it("preto contra branco é o máximo do WCAG, 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("bate a razão conhecida do WCAG pra #767676 contra branco (~4.54:1)", () => {
    expect(contrastRatio(hexToRgb("#767676"), WHITE)).toBeCloseTo(4.54, 1);
  });

  it("é simétrico", () => {
    const a = hexToRgb("#123456");
    const b = hexToRgb("#abcdef");
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe("deriveSurfacePalette", () => {
  it("nunca altera a cor escolhida — surface é sempre o hex original (minúsculo)", () => {
    expect(deriveSurfacePalette("#0B1220").surface).toBe("#0b1220");
    expect(deriveSurfacePalette("#f8fafc").surface).toBe("#f8fafc");
  });

  it("preto puro escolhe texto quase-branco", () => {
    const palette = deriveSurfacePalette("#000000");
    expect(hexToRgb(palette.textPrimary).r).toBeGreaterThan(200);
  });

  it("branco puro escolhe texto quase-preto", () => {
    const palette = deriveSurfacePalette("#ffffff");
    expect(hexToRgb(palette.textPrimary).r).toBeLessThan(60);
  });

  it("o azul-marinho escuro do .comercial-dark (--paper #080b16) escolhe texto claro e superfície elevada mais clara, batendo com --paper-raised #10172a real", () => {
    const palette = deriveSurfacePalette("#080b16");
    expect(hexToRgb(palette.textPrimary).r).toBeGreaterThan(200);
    expect(hexToRgb(palette.surfaceElevated).r).toBeGreaterThan(hexToRgb(palette.surface).r);
    const realPaperRaised = hexToRgb("#10172a");
    const derivedElevated = hexToRgb(palette.surfaceElevated);
    // mesma faixa de luminosidade do valor real desenhado à mão (não precisa bater exato)
    expect(Math.abs(derivedElevated.r - realPaperRaised.r)).toBeLessThan(30);
  });

  it("o cinza-claro padrão do Painel Master hoje (--paper #f8fafc) escolhe texto escuro, batendo com --ink #0f172a hardcoded hoje", () => {
    const palette = deriveSurfacePalette("#f8fafc");
    const text = hexToRgb(palette.textPrimary);
    const existingInk = hexToRgb("#0f172a");
    expect(text.r).toBeLessThan(60);
    expect(Math.abs(text.r - existingInk.r)).toBeLessThan(40);
  });

  it("é uma função pura e idempotente", () => {
    const a = deriveSurfacePalette("#4338ca");
    const b = deriveSurfacePalette("#4338ca");
    expect(a).toEqual(b);
  });

  it("superfície elevada sempre mais clara e recuada sempre mais escura que a base, clara ou escura", () => {
    for (const seed of ["#f8fafc", "#080b16", "#ffffff", "#000000", "#4338ca", "#767676"]) {
      const palette = deriveSurfacePalette(seed);
      const elevatedL = hexToRgb(palette.surfaceElevated);
      const recessedL = hexToRgb(palette.surfaceRecessed);
      const sum = (rgb: { r: number; g: number; b: number }) => rgb.r + rgb.g + rgb.b;
      expect(sum(elevatedL)).toBeGreaterThanOrEqual(sum(hexToRgb(palette.surface)) - 3);
      expect(sum(recessedL)).toBeLessThanOrEqual(sum(hexToRgb(palette.surface)) + 3);
    }
  });

  it("nunca gera hex fora do formato válido, nos extremos", () => {
    const validHex = /^#[0-9a-f]{6}$/;
    for (const seed of ["#000000", "#ffffff", "#808080", "#767676", "#4338ca"]) {
      const palette = deriveSurfacePalette(seed);
      for (const value of Object.values(palette)) expect(value).toMatch(validHex);
    }
  });

  it("textSecondary/textMuted nunca caem abaixo do mínimo de contraste quando existe solução — e nunca pioram o textPrimary quando não existe", () => {
    for (const seed of ["#f8fafc", "#080b16", "#4338ca", "#767676"]) {
      const palette = deriveSurfacePalette(seed);
      const bg = hexToRgb(seed);
      const secondaryRatio = contrastRatio(hexToRgb(palette.textSecondary), bg);
      const mutedRatio = contrastRatio(hexToRgb(palette.textMuted), bg);
      const primaryRatio = contrastRatio(hexToRgb(palette.textPrimary), bg);
      expect(secondaryRatio).toBeGreaterThanOrEqual(Math.min(4.5, primaryRatio) - 0.05);
      expect(mutedRatio).toBeGreaterThanOrEqual(Math.min(3, primaryRatio) - 0.05);
    }
  });
});
