/**
 * Deriva um conjunto coerente de tokens de superfície/texto/borda a partir de
 * UMA cor de fundo escolhida pelo usuário — o motor por trás do fundo
 * personalizável (Admin → Aparência). Sem lib externa: a matemática de
 * luminância relativa/contraste é a fórmula pública do WCAG 2.x, pequena e
 * estável; os passos de luminosidade (elevar/rebaixar superfície, afastar
 * borda) foram calibrados contra os dois exemplos coerentes que já existem
 * no código hoje (sidebar escura do admin, `.comercial-dark` do saas-core),
 * não escolhidos arbitrariamente.
 */

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return { r: parseInt(clean.slice(0, 2), 16), g: parseInt(clean.slice(2, 4), 16), b: parseInt(clean.slice(4, 6), 16) };
}

function rgbToHex({ r, g, b }: RGB): string {
  const channel = (value: number) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): HSL {
  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN), min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
  else if (max === gN) h = (bN - rN) / d + 2;
  else h = (rN - gN) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const sN = s / 100, lN = l / 100;
  if (sN === 0) return { r: lN * 255, g: lN * 255, b: lN * 255 };
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
  const p = 2 * lN - q;
  const hN = h / 360;
  return { r: hue2rgb(p, q, hN + 1 / 3) * 255, g: hue2rgb(p, q, hN) * 255, b: hue2rgb(p, q, hN - 1 / 3) * 255 };
}

function clampLightness(l: number): number {
  return Math.min(100, Math.max(0, l));
}

function srgbToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: RGB): number {
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

/** Fórmula de contraste do WCAG 2.x — (L1+0.05)/(L2+0.05), maior luminância primeiro. */
export function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a) + 0.05;
  const l2 = relativeLuminance(b) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function mixRgb(from: RGB, to: RGB, amount: number): RGB {
  return { r: from.r + (to.r - from.r) * amount, g: from.g + (to.g - from.g) * amount, b: from.b + (to.b - from.b) * amount };
}

const PURE_WHITE: RGB = { r: 255, g: 255, b: 255 };
const PURE_BLACK: RGB = { r: 0, g: 0, b: 0 };
// Quase-branco/quase-preto em vez de #fff/#000 puros — mesmo espírito dos
// tokens já hardcoded no app (--foreground #231d18, --sidebar-foreground #f9f2e7).
const NEAR_WHITE: RGB = { r: 245, g: 245, b: 240 };
const NEAR_BLACK: RGB = { r: 26, g: 23, b: 18 };

function bestTextColor(bg: RGB): RGB {
  return contrastRatio(bg, PURE_WHITE) >= contrastRatio(bg, PURE_BLACK) ? NEAR_WHITE : NEAR_BLACK;
}

/**
 * Puxa `text` em direção a `bg` o máximo possível (até `maxPull`) sem que o
 * contraste caia abaixo de `minRatio`. Sem solução perfeita pra alguns fundos
 * cinza-médio (contraste 4.5:1 é matematicamente inatingível com texto
 * preto-ou-branco em certas faixas) — nesse caso devolve o texto "cheio"
 * (amount=0) sem tentar forçar; quem chama decide se avisa o usuário.
 */
function pullTowardBackground(text: RGB, bg: RGB, minRatio: number, maxPull: number): RGB {
  const atMaxPull = mixRgb(text, bg, maxPull);
  if (contrastRatio(atMaxPull, bg) >= minRatio) return atMaxPull;
  let lo = 0, hi = maxPull, best = text;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const candidate = mixRgb(text, bg, mid);
    if (contrastRatio(candidate, bg) >= minRatio) {
      best = candidate;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

export type DerivedSurfaceRoles = {
  /** A cor escolhida, sem alteração nenhuma — nunca "corrigida" por baixo de contraste. */
  surface: string;
  /** Card/popover — alguns pontos de luminosidade acima da superfície base. */
  surfaceElevated: string;
  /** Secondary/muted — alguns pontos de luminosidade abaixo da superfície base. */
  surfaceRecessed: string;
  /** Borda — afastada da superfície na mesma direção do texto, pra continuar visível. */
  border: string;
  textPrimary: string;
  /** textPrimary puxado em direção à superfície, sem cair abaixo de 4.5:1. */
  textSecondary: string;
  /** Igual, mais puxado, sem cair abaixo de 3:1. */
  textMuted: string;
};

/** Calibrado contra `--sidebar*` (app principal, escuro) e `.comercial-dark` (saas-core) — ver deriveSurfacePalette.test.ts. */
export function deriveSurfacePalette(seedHex: string): DerivedSurfaceRoles {
  const seedRgb = hexToRgb(seedHex);
  const seedHsl = rgbToHsl(seedRgb);
  const text = bestTextColor(seedRgb);
  const surfaceReadsLight = text === NEAR_BLACK;

  const elevated = hslToRgb({ ...seedHsl, l: clampLightness(seedHsl.l + 5) });
  const recessed = hslToRgb({ ...seedHsl, l: clampLightness(seedHsl.l - 5) });
  const border = hslToRgb({ ...seedHsl, l: clampLightness(seedHsl.l + (surfaceReadsLight ? -14 : 14)) });

  return {
    surface: seedHex.toLowerCase(),
    surfaceElevated: rgbToHex(elevated),
    surfaceRecessed: rgbToHex(recessed),
    border: rgbToHex(border),
    textPrimary: rgbToHex(text),
    textSecondary: rgbToHex(pullTowardBackground(text, seedRgb, 4.5, 0.35)),
    textMuted: rgbToHex(pullTowardBackground(text, seedRgb, 3, 0.55)),
  };
}
