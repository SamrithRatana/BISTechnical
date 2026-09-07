/**
 * @file components/docs/docsAccent.ts
 * @description Chapter colour identities, as FULL literal class names.
 *
 * Tailwind's compiler only sees classes written out as complete strings in the
 * source, so `border-${accent}-500/25` would compile to nothing and every
 * chapter would render unstyled. Every variant is therefore spelled out here,
 * exactly as `download/PlatformCard.tsx` does for its two platforms.
 *
 * `hairline` and `glow` are `background` VALUES rather than classes: they are
 * the two sanctioned gradient appearances per card, and an arbitrary-value
 * class for each would be unreadable.
 *
 * ─── Why there are TWO authored maps, not one computed from the other ───────
 *
 * `ACCENT_LIGHT` repeats all six identities rather than deriving them, and the
 * literal-class rule above is only half the reason — a `-300` → `-700` rewrite
 * would have to build its string at runtime, which is the one thing Tailwind
 * cannot see. The other half is that these are not one design at two
 * brightnesses. On a near-black card a tint LIFTS: `bg-violet-500/10` under
 * `text-violet-300` reads as a glow. On white that same pair is a smudge under
 * text measuring ~1.6:1. So the light skin inverts the relationship instead of
 * shifting it — opaque `-50`/`-100` fills, `-600`/`-700`/`-800` ink, gradient
 * stops moved off the `-300`/`-400` steps, and `glow` dialled from 0.16 to
 * 0.07 because a wash drawn to raise a black card only dirties a white one.
 * Two authored maps state that; one computed map would bury it in a rule that
 * cannot be read off the page.
 *
 * Reach either one through `accentSkin(accent, isDark)`. Reading `ACCENT[x]`
 * directly is exactly what left the light page wearing the dark skin.
 */

import type { DocsAccent } from "./docsTypes";

export interface AccentSkin {
  /** Card border at rest. */
  border: string;
  /** Icon tile. */
  tile: string;
  /** Small pill / chapter number. */
  chip: string;
  /** Bare text tint. */
  text: string;
  /** Step index bubble. */
  step: string;
  /** Top hairline gradient — a `background` value, not a class. */
  hairline: string;
  /** Ambient wash inside the card — a `background` value, not a class. */
  glow: string;
}

export const ACCENT: Record<DocsAccent, AccentSkin> = {
  violet: {
    border: "border-violet-500/25",
    tile: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    text: "text-violet-300",
    step: "border-violet-400/40 bg-violet-500/15 text-violet-200",
    hairline: "linear-gradient(90deg, rgb(167 139 250 / 0.9), rgb(34 211 238 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(139 92 246 / 0.16), transparent 62%)",
  },
  cyan: {
    border: "border-cyan-500/25",
    tile: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    text: "text-cyan-300",
    step: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
    hairline: "linear-gradient(90deg, rgb(34 211 238 / 0.9), rgb(52 211 153 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(6 182 212 / 0.16), transparent 62%)",
  },
  emerald: {
    border: "border-emerald-500/25",
    tile: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    text: "text-emerald-300",
    step: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    hairline: "linear-gradient(90deg, rgb(52 211 153 / 0.9), rgb(34 211 238 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(16 185 129 / 0.16), transparent 62%)",
  },
  amber: {
    border: "border-amber-500/25",
    tile: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    text: "text-amber-300",
    step: "border-amber-400/40 bg-amber-500/15 text-amber-200",
    hairline: "linear-gradient(90deg, rgb(252 211 77 / 0.9), rgb(251 146 60 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(245 158 11 / 0.14), transparent 62%)",
  },
  rose: {
    border: "border-rose-500/25",
    tile: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    text: "text-rose-300",
    step: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    hairline: "linear-gradient(90deg, rgb(251 113 133 / 0.9), rgb(244 114 182 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(244 63 94 / 0.14), transparent 62%)",
  },
  sky: {
    border: "border-sky-500/25",
    tile: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    text: "text-sky-300",
    step: "border-sky-400/40 bg-sky-500/15 text-sky-200",
    hairline: "linear-gradient(90deg, rgb(56 189 248 / 0.9), rgb(129 140 248 / 0.3), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(14 165 233 / 0.16), transparent 62%)",
  },
};

/**
 * The same six identities on a WHITE card.
 *
 * Measured, not eyeballed — and measured against the OKLCH palette Tailwind 4
 * actually ships in `node_modules/tailwindcss/theme.css`, which is a few
 * points off the v3 hexes these steps are remembered by. Every ink pair clears
 * 4.5:1 and every border clears 3:1:
 *
 *   text `-700` on white    violet 7.3  cyan 5.3  emerald 5.4  amber 5.0
 *                           rose 6.0    sky 5.9
 *   text `-700` on `-50`    violet 6.7  cyan 5.1  emerald 5.1  amber 4.9
 *                           rose 5.5    sky 5.5
 *   text `-800` on `-100`   6.4 – 7.7 across all six
 *   border `-600` on white  violet 5.9  cyan 3.6  emerald 3.7  amber 3.2
 *                           rose 4.5    sky 4.0
 *
 * `glow` costs at most a quarter of a point on the worst hue (amber, 5.03 on
 * bare white → 4.80 over the wash), so the ambient tint cannot push anything
 * under the bar on its own.
 *
 * Three of those are decisions rather than defaults:
 *
 * - **The borders are `-600`, not `-300` or `-500/40`.** Both of those look
 *   like the right answer and land between 1.37:1 and 1.92:1 across the six
 *   hues — barely stronger than the `border-slate-200` (1.23:1) this pass
 *   exists to stop shipping. `-600` solid is the lightest step where all six
 *   clear 3:1; at `-500` only violet (4.40) and rose (3.75) make it, while
 *   cyan (2.37), emerald (2.47), amber (2.13) and sky (2.71) do not. At 1px
 *   it reads as a crisp identity hairline, which is the job this field does.
 * - **The fills are opaque `-50`/`-100`, not `bg-*-500/10`.** Both are legible
 *   on white, but an alpha fill lets `glow` through from underneath and puts
 *   the card position back into the ink's contrast budget. An opaque fill
 *   makes a pill's number one fixed measurement instead of one that depends on
 *   where on the card it landed.
 * - **`step` carries `-800` ink on the stronger `-100` fill.** Amber is why:
 *   `text-amber-700` on `bg-amber-100` is 4.52:1 — passing with two hundredths
 *   to spare, for a 10px numeral. `-800` takes it to 6.36:1. (`text-amber-600`,
 *   the step that looks right, is 3.20:1 on white and was never available.)
 *
 * `hairline` keeps the dark map's two-stop-then-transparent shape and moves the
 * stops from the `-300`/`-400` steps to `-600`, which puts the leading edge
 * between 3.4:1 and 5.2:1 on white. Amber leads on `-700` (rgb(180 83 9))
 * rather than `-600`: at `-600` it measures 3.00:1, and a value that passes on
 * the boundary is a value nobody can safely nudge later.
 *
 * `glow` is kept rather than dropped, at 0.07 — 0.06 for the two hues the dark
 * map already runs cooler. The dark version is a 0.14–0.16 wash whose job is
 * lifting a near-black card, and at that strength on white it is a dirty
 * corner; the same hue and geometry at half the alpha still carries the
 * chapter identity into the card, which is what it was drawn for.
 */
export const ACCENT_LIGHT: Record<DocsAccent, AccentSkin> = {
  violet: {
    border: "border-violet-600",
    tile: "border-violet-600 bg-violet-50 text-violet-700",
    chip: "border-violet-600 bg-violet-50 text-violet-700",
    text: "text-violet-700",
    step: "border-violet-700 bg-violet-100 text-violet-800",
    hairline: "linear-gradient(90deg, rgb(124 58 237 / 0.95), rgb(8 145 178 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(139 92 246 / 0.07), transparent 62%)",
  },
  cyan: {
    border: "border-cyan-600",
    tile: "border-cyan-600 bg-cyan-50 text-cyan-700",
    chip: "border-cyan-600 bg-cyan-50 text-cyan-700",
    text: "text-cyan-700",
    step: "border-cyan-700 bg-cyan-100 text-cyan-800",
    hairline: "linear-gradient(90deg, rgb(8 145 178 / 0.95), rgb(5 150 105 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(6 182 212 / 0.07), transparent 62%)",
  },
  emerald: {
    border: "border-emerald-600",
    tile: "border-emerald-600 bg-emerald-50 text-emerald-700",
    chip: "border-emerald-600 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
    step: "border-emerald-700 bg-emerald-100 text-emerald-800",
    hairline: "linear-gradient(90deg, rgb(5 150 105 / 0.95), rgb(8 145 178 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(16 185 129 / 0.07), transparent 62%)",
  },
  amber: {
    border: "border-amber-600",
    tile: "border-amber-600 bg-amber-50 text-amber-700",
    chip: "border-amber-600 bg-amber-50 text-amber-700",
    text: "text-amber-700",
    step: "border-amber-700 bg-amber-100 text-amber-800",
    hairline: "linear-gradient(90deg, rgb(180 83 9 / 0.95), rgb(234 88 12 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(245 158 11 / 0.06), transparent 62%)",
  },
  rose: {
    border: "border-rose-600",
    tile: "border-rose-600 bg-rose-50 text-rose-700",
    chip: "border-rose-600 bg-rose-50 text-rose-700",
    text: "text-rose-700",
    step: "border-rose-700 bg-rose-100 text-rose-800",
    hairline: "linear-gradient(90deg, rgb(225 29 72 / 0.95), rgb(219 39 119 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(244 63 94 / 0.06), transparent 62%)",
  },
  sky: {
    border: "border-sky-600",
    tile: "border-sky-600 bg-sky-50 text-sky-700",
    chip: "border-sky-600 bg-sky-50 text-sky-700",
    text: "text-sky-700",
    step: "border-sky-700 bg-sky-100 text-sky-800",
    hairline: "linear-gradient(90deg, rgb(2 132 199 / 0.95), rgb(79 70 229 / 0.45), transparent)",
    glow: "radial-gradient(circle at 28% -10%, rgb(14 165 233 / 0.07), transparent 62%)",
  },
};

/** The skin for `accent` in the theme `isDark` describes. */
export function accentSkin(accent: DocsAccent, isDark: boolean): AccentSkin {
  return isDark ? ACCENT[accent] : ACCENT_LIGHT[accent];
}
