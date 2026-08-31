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
