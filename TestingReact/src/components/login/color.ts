/**
 * @file components/login/color.ts
 * @description The prism: one user accent in, a hue-shifted triad out. Every
 * chromatic surface on the login stage (rim conics, shear blades, aurora
 * tints, focus rims, shard glass) derives from `deriveHolo(accentHex)` —
 * there is deliberately no second colour source, so a user picking a new
 * accent in Settings re-grades the whole page like a LUT.
 *
 * Guards, because the accent is arbitrary user input:
 * - saturation < 12% (near-gray): hue rotation would invent colour that was
 *   never chosen, so the triad falls back to lightness-shifted variants.
 * - before derivation the working copy is clamped to S 55–90% / L 40–65%,
 *   so a neon or near-black accent still yields readable companions. The
 *   returned `a` is always the RAW accent — buttons already use it as-is.
 */

export interface HoloTriad {
  /** The raw user accent, untouched. */
  a: string;
  /** Companion hue, +48° around the wheel. */
  b: string;
  /** Companion hue, −56° around the wheel. */
  c: string;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Rotate a hex colour around the hue wheel; near-gray inputs shift lightness instead. */
function shiftHue(hex: string, deg: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  if (hsl.s < 0.12) {
    // Chroma guard: don't invent colour for a gray accent.
    return hslToHex({ ...hsl, l: clamp(hsl.l + (deg > 0 ? 0.12 : -0.1), 0.12, 0.85) });
  }
  return hslToHex({
    h: hsl.h + deg,
    s: clamp(hsl.s, 0.55, 0.9),
    l: clamp(hsl.l, 0.4, 0.65),
  });
}

/** The one derivation rule for the whole stage. Memoise per accent. */
export function deriveHolo(accentHex: string): HoloTriad {
  return {
    a: accentHex,
    b: shiftHue(accentHex, 48),
    c: shiftHue(accentHex, -56),
  };
}
