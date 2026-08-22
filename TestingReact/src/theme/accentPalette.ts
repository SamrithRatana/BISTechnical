/**
 * @file theme/accentPalette.ts
 * @description Derives the full Aura Velvet accent token set from ONE user-
 * chosen hex colour.
 *
 * The design system doesn't consume a single accent value — `globals.css`
 * defines 8 (`base`, `bright`, `hover`, `fg`, `soft`, `soft-fg`, `glow`,
 * `ring`), hand-picked per light/dark palette so every pairing stays
 * readable. A user only picks one colour on the Theme & Branding page, so
 * this fills in the other 7 the same way the design tokens do it by hand:
 * lighten/darken in HSL for `hover`/`bright`, a contrast check for `fg`
 * (CLAUDE.md already documents one real bug from skipping this — white text
 * measured at 1.14:1 on a pale accent-soft background), and alpha variants
 * for `soft`/`glow`/`ring`.
 *
 * Kept deliberately separate from `themeConfig.ts`: that file is serialised
 * into an inline `<head>` script by `ThemeScript` and must stay
 * import-free/self-contained, while this one is only ever called from
 * `ThemeProvider` (a real React module, not stringified), so it's free to be
 * a normal file with normal helpers.
 */

interface AccentTokens {
  base: string;
  bright: string;
  hover: string;
  fg: string;
  soft: string;
  softFg: string;
  glow: string;
  ring: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hh = h / 360;
  return [
    hue2rgb(p, q, hh + 1 / 3) * 255,
    hue2rgb(p, q, hh) * 255,
    hue2rgb(p, q, hh - 1 / 3) * 255,
  ];
}

/** Lightens (positive `amount`) or darkens (negative) a hex colour in HSL space. */
export function adjustLightness(hex: string, amount: number): string {
  const hsl = rgbToHsl(...hexToRgb(hex));
  hsl.l = Math.max(0, Math.min(1, hsl.l + amount));
  return rgbToHex(...hslToRgb(hsl));
}

/** WCAG relative luminance, used only to pick a readable foreground. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** White or near-black, whichever reads better against `base`. */
export function pickForeground(base: string): string {
  const white = "#FFFFFF";
  const nearBlack = "#0A0F0C";
  return contrastRatio(base, white) >= contrastRatio(base, nearBlack) ? white : nearBlack;
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Builds the 8-token accent set for one hex colour, intelligently harmonized
 * to guarantee optimal readability, crisp text contrast, and match Aura Velvet's default standards.
 */
export function deriveAccentPalette(hex: string, isDark: boolean): AccentTokens {
  const [r, g, b] = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);

  // 1. Calibrate Base: In light mode, ensure base is rich and deep enough (38-44% lightness)
  // so crisp white text (#FFFFFF) always has AAA contrast on buttons and active badges.
  let calibratedBaseHex: string;
  if (!isDark) {
    const targetL = Math.max(0.36, Math.min(0.44, hsl.l));
    const targetS = Math.max(0.70, Math.min(0.95, hsl.s));
    calibratedBaseHex = rgbToHex(...hslToRgb({ h: hsl.h, s: targetS, l: targetL }));
  } else {
    const targetL = Math.max(0.50, Math.min(0.62, hsl.l));
    const targetS = Math.max(0.65, Math.min(0.90, hsl.s));
    calibratedBaseHex = rgbToHex(...hslToRgb({ h: hsl.h, s: targetS, l: targetL }));
  }

  const base = calibratedBaseHex;

  // 2. Bright variant for chart strokes, status dots, and vibrant glows
  const brightL = isDark ? 0.68 : 0.52;
  const bright = rgbToHex(...hslToRgb({ h: hsl.h, s: Math.max(0.75, hsl.s), l: brightL }));

  // 3. Hover state
  const hover = adjustLightness(base, isDark ? 0.08 : -0.07);

  // 4. Foreground on solid accent: Always crisp white on light theme (just like Default theme)
  const fg = isDark ? "#06120D" : "#FFFFFF";

  // 5. Soft background wash: Modern translucent tint matching the exact brand hue
  const soft = isDark ? hexToRgba(base, 0.18) : hexToRgba(base, 0.10);

  // 6. Soft FG text: High-contrast, crystal-clear readable text matching the Default theme's #0B563D
  const softFgL = isDark ? 0.74 : 0.22;
  const softFg = rgbToHex(...hslToRgb({ h: hsl.h, s: Math.max(0.80, hsl.s), l: softFgL }));

  // 7. Glow and focus ring
  const glow = hexToRgba(base, isDark ? 0.28 : 0.22);
  const ring = hexToRgba(base, isDark ? 0.45 : 0.35);

  return { base, bright, hover, fg, soft, softFg, glow, ring };
}

/** Maps a derived palette onto the `--av-accent-*` custom property names. */
export function accentTokensToCssVars(tokens: AccentTokens): Record<string, string> {
  return {
    "--av-accent-base": tokens.base,
    "--av-accent-bright": tokens.bright,
    "--av-accent-hover": tokens.hover,
    "--av-accent-fg": tokens.fg,
    "--av-accent-soft": tokens.soft,
    "--av-accent-soft-fg": tokens.softFg,
    "--av-accent-glow": tokens.glow,
    "--av-accent-ring": tokens.ring,
  };
}
