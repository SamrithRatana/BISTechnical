/**
 * @file components/download/motion.ts
 * @description Every timing constant the download hub animates with — the same
 * discipline as `lib/animations.ts`, scoped to this page's own choreography.
 * Nothing in `components/download/` writes an inline duration.
 *
 * The load timeline (Aperture Stage spec):
 *   0ms header → 100–420ms hero copy stagger → 250–1150ms phone settle →
 *   700/800/900ms chips → ~1150–2300ms one-shot screen verification.
 */

import type { Transition } from "framer-motion";

// ─── Easings ────────────────────────────────────────────────────────────────

/** Camera-move settle for the phone rig's entrance. */
export const SETTLE_EASE = [0.16, 1, 0.3, 1] as const;

/** Standard reveal ease for copy and sections. */
export const REVEAL_EASE = [0.22, 0.61, 0.36, 1] as const;

// ─── Durations (seconds) ────────────────────────────────────────────────────

export const DUR = {
  /** Button/hover feedback. */
  tap: 0.15,
  /** Panel expand / chevron / crossfades. */
  panel: 0.2,
  /** Copy + section reveals. */
  reveal: 0.35,
  /** Card entrances. */
  card: 0.45,
  /** Phone rig settle. */
  settle: 0.9,
  /** One scanline sweep. */
  sweep: 0.9,
  /** The 0 → 59 count-up. */
  count: 0.7,
} as const;

// ─── Load timeline offsets (seconds) ────────────────────────────────────────

export const LOAD = {
  heroStagger: 0.08,
  heroDelay: 0.1,
  phoneDelay: 0.25,
  chipDelays: [0.7, 0.8, 0.9] as const,
  /** When the screen's one-shot verification sequence begins. */
  scanDelay: 1.15,
} as const;

// ─── Springs ────────────────────────────────────────────────────────────────

/** Pointer tilt (hero rig ±11°, platform cards ±3°). */
export const TILT_SPRING = { stiffness: 120, damping: 18, mass: 0.8 } as const;

/** The "UNLOCKED" verdict chip's rotateX stamp. */
export const STAMP_SPRING: Transition = { type: "spring", stiffness: 300, damping: 22 };

// ─── Scroll reveals ─────────────────────────────────────────────────────────

/** Shared `viewport` config: reveal once, slightly before fully in view. */
export const VIEWPORT_ONCE = { once: true, margin: "-15% 0px" } as const;

/** Tilt ranges, degrees. */
export const HERO_TILT_RANGE = 11;
export const CARD_TILT_RANGE = 3;

/** The phone's resting pose — never flat-on. */
export const REST_POSE = { rotateX: 6, rotateY: -14 } as const;
