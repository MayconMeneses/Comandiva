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
    expect(deriveSurfacePalette("#f6f1e8").surface).toBe("#f6f1e8");
  });

  it("preto puro escolhe texto quase-branco", () => {
    const palette = deriveSurfacePalette("#000000");
    expect(contrastRatio(hexToRgb(palette.textPrimary), BLACK)).toBeGreaterThan(contrastRatio(BLACK, BLACK) + 1);
    expect(hexToRgb(palette.textPrimary).r).toBeGreaterThan(200);
  });

  it("branco puro escolhe texto quase-preto", () => {
    const palette = deriveSurfacePalette("#ffffff");
    expect(hexToRgb(palette.textPrimary).r).toBeLessThan(60);
  });

  it("um azul-marinho escuro (perto do .comercial-dark do saas-core) escolhe texto claro", () => {
    const palette = deriveSurfacePalette("#080b16");
    expect(hexToRgb(palette.textPrimary).r).toBeGreaterThan(200);
    // superfície elevada mais clara que a base, igual paper-raised > paper no saas-core
    expect(hexToRgb(palette.surfaceElevated).r).toBeGreaterThan(hexToRgb(palette.surface).r);
  });

  it("o creme atual do app principal (#f6f1e8) escolhe texto escuro, batendo com o --foreground hardcoded hoje", () => {
    const palette = deriveSurfacePalette("#f6f1e8");
    const text = hexToRgb(palette.textPrimary);
    const existingForeground = hexToRgb("#231d18");
    // mesma "família" de quase-preto que já está hardcoded hoje (guarda de regressão)
    expect(text.r).toBeLessThan(60);
    expect(Math.abs(text.r - existingForeground.r)).toBeLessThan(40);
  });

  it("é uma função pura e idempotente", () => {
    const a = deriveSurfacePalette("#4338ca");
    const b = deriveSurfacePalette("#4338ca");
    expect(a).toEqual(b);
  });

  it("superfície elevada sempre mais clara e recuada sempre mais escura que a base, clara ou escura", () => {
    for (const seed of ["#f6f1e8", "#080b16", "#ffffff", "#000000", "#4338ca", "#767676"]) {
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
    for (const seed of ["#000000", "#ffffff", "#808080", "#767676", "#008cfe"]) {
      const palette = deriveSurfacePalette(seed);
      for (const value of Object.values(palette)) expect(value).toMatch(validHex);
    }
  });

  it("textSecondary/textMuted nunca caem abaixo do mínimo de contraste quando existe solução — e nunca pioram o textPrimary quando não existe", () => {
    for (const seed of ["#f6f1e8", "#080b16", "#4338ca", "#008cfe", "#767676"]) {
      const palette = deriveSurfacePalette(seed);
      const bg = hexToRgb(seed);
      const secondaryRatio = contrastRatio(hexToRgb(palette.textSecondary), bg);
      const mutedRatio = contrastRatio(hexToRgb(palette.textMuted), bg);
      const primaryRatio = contrastRatio(hexToRgb(palette.textPrimary), bg);
      // best-effort: nunca abaixo do que o próprio textPrimary alcança (nunca "piora")
      expect(secondaryRatio).toBeGreaterThanOrEqual(Math.min(4.5, primaryRatio) - 0.05);
      expect(mutedRatio).toBeGreaterThanOrEqual(Math.min(3, primaryRatio) - 0.05);
    }
  });
});
