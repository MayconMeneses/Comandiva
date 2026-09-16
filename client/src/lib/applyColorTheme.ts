import { COLOR_THEME_KEYS, COLOR_THEMES, DEFAULT_COLOR_THEME, type ColorThemeKey } from "@shared/colorThemes";

function resolveThemeKey(themeKey: string | null | undefined): ColorThemeKey {
  return (COLOR_THEME_KEYS as readonly string[]).includes(themeKey ?? "") ? (themeKey as ColorThemeKey) : DEFAULT_COLOR_THEME;
}

/**
 * Aplica o tema de cor do restaurante (site público + admin, chamado nos
 * dois de forma independente — cada superfície já busca `catalog.settings`
 * por conta própria). Sobrescreve as variáveis CSS direto no :root; um
 * restaurante em "classico" nunca chama isto de fato mudar nada, já que os
 * valores batem com os defaults declarados em index.css.
 */
export function applyColorTheme(themeKey: string | null | undefined) {
  const theme = COLOR_THEMES[resolveThemeKey(themeKey)];
  const root = document.documentElement.style;
  root.setProperty("--primary", theme.primary);
  root.setProperty("--primary-hover", theme.primaryHover);
  root.setProperty("--primary-hover-light", theme.primaryHoverLight);
  root.setProperty("--primary-foreground", theme.primaryForeground);
  root.setProperty("--background", theme.background);
}
