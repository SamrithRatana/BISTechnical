/**
 * @file components/login/motion.ts
 * @description Every timing constant the login stage animates with — the same
 * discipline as `lib/animations.ts` and `components/download/motion.ts`,
 * scoped to this page's own choreography. Nothing in `components/login/`
 * writes an inline duration.
 *
 * Load timeline (Depth Stage spec):
 *   0ms backdrop → 50ms card settle → 120–450ms form cascade →
 *   curtain sweep finishes ~900ms.
 *
 * Ambient budget at rest (full mode only — static mode runs NONE of these):
 * ONE aurora drift (the right orb was demoted to a static glow to fund the
 * Prismwell layers), one particle-layer drift, one beam sweep along the card
 * rim, and the showcase auto-advance timer. Everything is transform/opacity;
 * nothing animates layout, filter or background-position.
 */

import type { Transition } from "framer-motion";

// ─── Easings ────────────────────────────────────────────────────────────────

/** Camera-move settle for the card's entrance (matches the download hero). */
export const SETTLE_EASE = [0.16, 1, 0.3, 1] as const;

/** Standard reveal ease for copy, fields and panels. */
export const REVEAL_EASE = [0.22, 0.61, 0.36, 1] as const;

/** The curtain's sweep — silky, luxurious deceleration curve. */
export const CURTAIN_EASE = [0.25, 1, 0.4, 1] as const;

// ─── Durations (seconds) ────────────────────────────────────────────────────

export const DUR = {
  /** Method-panel crossfades. */
  panel: 0.24,
  /** Copy + field reveals. */
  reveal: 0.3,
  /** Method-deck card entrances. */
  card: 0.38,
  /** Curtain travel between sign-in and method-selector modes. */
  curtain: 0.56,
} as const;

// ─── Load timeline offsets (seconds) ────────────────────────────────────────

export const LOAD = {
  cardDelay: 0.04,
  formDelay: 0.08,
  formStagger: 0.04,
  deckStagger: 0.045,
} as const;

/** The light beam sweeping the card's top rim (one ambient loop). */
export const BEAM_SWEEP = {
  duration: 6,
  repeatDelay: 1.5,
} as const;

/**
 * The prismatic shear — three chromatic blades riding the curtain's leading
 * edge. Blades animate RELATIVE x offsets (they are children of the already-
 * translating curtain; re-animating the panel's own keyframes would
 * double-translate them). Spread fans a→b→c apart mid-sweep and reconverges
 * into the resting 1px light seam.
 */
export const SHEAR = {
  /** Max chromatic separation at mid-sweep, px, per blade index. */
  spreadPx: [0, 16, 28],
  /** Per-blade stagger into the sweep (seconds). */
  delays: [0, 0.04, 0.08],
  /** The one-shot rim refraction flash after the curtain settles. */
  flashDuration: 0.3,
} as const;

/**
 * The submit "gravity snap": the button pulses once as the pipeline starts,
 * and PipelineOverlay's entrance is delayed this long so the overlay reads
 * as summoned BY the press rather than appearing over it.
 */
export const OVERLAY_SUMMON_DELAY = 0.12;

/** Front shard extrusion-boot delays after the card starts settling. */
export const SHARD_DELAYS = [0.12, 0.18] as const;

// ─── Springs ────────────────────────────────────────────────────────────────

/** Pointer tilt for the whole stage (±STAGE_TILT_RANGE degrees) — natural, smooth physics. */
export const TILT_SPRING = { stiffness: 140, damping: 22, mass: 0.75 } as const;

/** Shared-element travel in the showcase (the tab dock's gliding pill). */
export const COVERFLOW_SPRING: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
};

// ─── Ranges & timers ────────────────────────────────────────────────────────

/**
 * Stage tilt, degrees. Deliberately shallow: the login card carries live form
 * fields, and text under a steep 3D transform rasterizes soft. The floating
 * chips (deeper Z) are what sell the depth, not the card angle.
 */
export const STAGE_TILT_RANGE = 3;

/** Showcase auto-advance cadence (ms). Paused on hover and in static mode. */
export const AUTO_ADVANCE_MS = 4500;
