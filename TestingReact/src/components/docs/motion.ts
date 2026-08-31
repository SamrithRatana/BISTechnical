/**
 * @file components/docs/motion.ts
 * @description Every timing constant the Docs hub animates with — the same
 * discipline as `lib/animations.ts` and `components/download/motion.ts`,
 * scoped to this page's own choreography. Nothing in `components/docs/`
 * writes an inline duration.
 *
 * The load timeline ("Codex Atlas" spec):
 *   0ms header → 80–420ms hero copy stagger → 200–1300ms atlas settle →
 *   650/780/910ms orbit glyphs → sections reveal on scroll.
 */

import type { Transition } from "framer-motion";

// ─── Easings ────────────────────────────────────────────────────────────────

/** Camera-move settle for the atlas rig's entrance. */
export const SETTLE_EASE = [0.16, 1, 0.3, 1] as const;

/** Standard reveal ease for copy and sections. */
export const REVEAL_EASE = [0.22, 0.61, 0.36, 1] as const;

// ─── Durations (seconds) ────────────────────────────────────────────────────

export const DUR = {
  /** Accordion body, chevron, crossfades. */
  panel: 0.22,
  /** Copy + section reveals. */
  reveal: 0.35,
  /** Card entrances. */
  card: 0.45,
  /** Atlas rig settle. */
  settle: 1.0,
} as const;

// ─── Load timeline offsets (seconds) ────────────────────────────────────────

export const LOAD = {
  heroStagger: 0.08,
  heroDelay: 0.08,
  atlasDelay: 0.2,
  glyphDelays: [0.65, 0.78, 0.91, 1.04] as const,
} as const;

// ─── Springs ────────────────────────────────────────────────────────────────

/** Pointer tilt (atlas ±13°, chapter cards ±3.5°). */
export const TILT_SPRING = { stiffness: 120, damping: 18, mass: 0.8 } as const;

/** The reading-progress bar and the scroll-spy pill. */
export const SPY_SPRING: Transition = { type: "spring", stiffness: 420, damping: 34 };

// ─── Scroll reveals ─────────────────────────────────────────────────────────

/** Shared `viewport` config: reveal once, slightly before fully in view. */
export const VIEWPORT_ONCE = { once: true, margin: "-12% 0px" } as const;

/** Tilt ranges, degrees. */
export const ATLAS_TILT_RANGE = 13;
export const CARD_TILT_RANGE = 3.5;

/** The atlas's resting pose — never flat-on. */
export const ATLAS_REST_POSE = { rotateX: 14, rotateY: -22 } as const;

/** How far apart the atlas planes sit on Z, in px. */
export const PLANE_GAP_PX = 46;

/**
 * How much further apart the atlas planes fan out in static mode.
 *
 * Lite Mode forces `transform-style: flat`, which collapses the Z gap above to
 * nothing — without this the five planes would sit almost on top of one
 * another and only the front card would be readable.
 */
export const STATIC_PLANE_SPREAD = 2.3;
