import { COLOR_THEME_KEYS, COLOR_THEMES, DEFAULT_COLOR_THEME, type ColorThemeKey } from "@shared/colorThemes";
import { deriveSurfacePalette } from "@shared/deriveSurfacePalette";

function resolveThemeKey(themeKey: string | null | undefined): ColorThemeKey {
  return (COLOR_THEME_KEYS as readonly string[]).includes(themeKey ?? "") ? (themeKey as ColorThemeKey) : DEFAULT_COLOR_THEME;
}

/**
 * Aplica o tema de cor do restaurante (site público + admin, chamado nos
 * dois de forma independente — cada superfície já busca `catalog.settings`
 * por conta própria). Sobrescreve as variáveis CSS direto no :root.
 *
 * `primary*` vem sempre do tema escolhido (7 presets) — cor de marca, fora do
 * motor de derivação de propósito. O FUNDO do sistema (background/foreground/
 * card/popover/secondary/muted/border/input) vem de `customBackgroundColor`
 * quando preenchido — derivado por `deriveSurfacePalette` — ou do `background`
 * pastel do próprio tema quando não há cor personalizada (mesmo valor de
 * sempre, zero mudança visual pra quem nunca configurou nada).
 */
export function applyColorTheme(themeKey: string | null | undefined, customBackgroundColor?: string | null) {
  const theme = COLOR_THEMES[resolveThemeKey(themeKey)];
  const root = document.documentElement.style;
  root.setProperty("--primary", theme.primary);
  root.setProperty("--primary-hover", theme.primaryHover);
  root.setProperty("--primary-hover-light", theme.primaryHoverLight);
  root.setProperty("--primary-foreground", theme.primaryForeground);

  const derived = deriveSurfacePalette(customBackgroundColor ?? theme.background);
  root.setProperty("--background", derived.surface);
  root.setProperty("--foreground", derived.textPrimary);
  root.setProperty("--card", derived.surfaceElevated);
  root.setProperty("--card-foreground", derived.textPrimary);
  root.setProperty("--popover", derived.surfaceElevated);
  root.setProperty("--popover-foreground", derived.textPrimary);
  root.setProperty("--secondary", derived.surfaceRecessed);
  root.setProperty("--secondary-foreground", derived.textSecondary);
  root.setProperty("--muted", derived.surfaceRecessed);
  root.setProperty("--muted-foreground", derived.textMuted);
  root.setProperty("--border", derived.border);
  root.setProperty("--input", derived.border);
}
