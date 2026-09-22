import { deriveSurfacePalette } from "@shared/deriveSurfacePalette";

const DEFAULT_PAPER = "#f8fafc";

/**
 * Aparência do próprio Painel Master — espelha applyColorTheme.ts do app
 * principal. `--accent`/`--accent-hover` (indigo de marca) ficam de fora do
 * propósito, sempre fixos; só a família fundo/superfície/texto/borda é
 * derivada a partir de `backgroundColor`.
 */
export function applyPanelTheme(backgroundColor: string | null | undefined) {
  const root = document.documentElement.style;
  const derived = deriveSurfacePalette(backgroundColor ?? DEFAULT_PAPER);
  root.setProperty("--paper", derived.surface);
  root.setProperty("--ink", derived.textPrimary);
  root.setProperty("--paper-raised", derived.surfaceElevated);
  root.setProperty("--ink-soft", derived.textSecondary);
  root.setProperty("--border", derived.border);
}
