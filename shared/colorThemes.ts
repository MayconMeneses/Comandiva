/**
 * Catálogo dos temas de cor de marca (recurso pago, feature "custom_theme")
 * — fonte única de verdade consumida pelo backend (validação do input) e
 * pelo frontend (aplicar as variáveis CSS + desenhar as amostras no
 * seletor). "classico" reproduz exatamente os hex que já existiam
 * hardcoded em toda a base antes do seletor existir — nenhum restaurante
 * muda de aparência até escolher outro tema.
 */
export const COLOR_THEME_KEYS = ["classico", "azul", "esmeralda", "vinho", "grafite", "ambar", "ameixa"] as const;
export type ColorThemeKey = (typeof COLOR_THEME_KEYS)[number];

export type ColorThemeDefinition = {
  key: ColorThemeKey;
  label: string;
  primary: string;
  /** Hover em superfícies claras (a maioria dos botões) — tom mais escuro que `primary`. */
  primaryHover: string;
  /** Hover em superfícies escuras (header/hero do cardápio público) — tom mais claro que `primary`, pra continuar visível sobre fundo escuro. */
  primaryHoverLight: string;
  primaryForeground: string;
  /**
   * Fundo da área de conteúdo (site público + admin) — tom bem claro da
   * mesma família de cor do tema, pra dar identidade visual real ao fundo
   * sem comprometer a leitura. O texto NUNCA muda de cor entre temas (fica
   * sempre `--foreground`, #231d18) — só o fundo por trás do conteúdo.
   */
  background: string;
};

export const COLOR_THEMES: Record<ColorThemeKey, ColorThemeDefinition> = {
  classico: { key: "classico", label: "Clássico", primary: "#b4472d", primaryHover: "#943722", primaryHoverLight: "#cf5b40", primaryForeground: "#fffaf4", background: "#f6f1e8" },
  azul: { key: "azul", label: "Azul Profissional", primary: "#1d4ed8", primaryHover: "#1e40af", primaryHoverLight: "#3b82f6", primaryForeground: "#ffffff", background: "#eaf1fb" },
  esmeralda: { key: "esmeralda", label: "Verde Esmeralda", primary: "#047857", primaryHover: "#065f46", primaryHoverLight: "#10b981", primaryForeground: "#ffffff", background: "#eaf6f0" },
  vinho: { key: "vinho", label: "Vinho", primary: "#9f1239", primaryHover: "#881337", primaryHoverLight: "#e11d48", primaryForeground: "#ffffff", background: "#f9eef1" },
  grafite: { key: "grafite", label: "Grafite", primary: "#334155", primaryHover: "#1e293b", primaryHoverLight: "#64748b", primaryForeground: "#ffffff", background: "#eef1f4" },
  ambar: { key: "ambar", label: "Âmbar Dourado", primary: "#92400e", primaryHover: "#78350f", primaryHoverLight: "#d97706", primaryForeground: "#ffffff", background: "#faf3e6" },
  ameixa: { key: "ameixa", label: "Ameixa", primary: "#7e22ce", primaryHover: "#6b21a8", primaryHoverLight: "#a855f7", primaryForeground: "#ffffff", background: "#f3edf9" },
};

export const DEFAULT_COLOR_THEME: ColorThemeKey = "classico";
