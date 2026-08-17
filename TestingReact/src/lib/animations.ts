/**
 * @file lib/animations.ts
 * @description Every duration, easing and variant the app animates with.
 *
 * The point of centralising these is consistency, not reuse. Animations
 * written per-component drift: one modal opens in 200ms and the next in 350ms,
 * one uses ease-out and another a spring, and the interface stops feeling like
 * one product. Everything below is imported, never retyped.
 *
 * Two rules hold, inherited from `globals.css`:
 *
 * 1. **`transform` and `opacity` only.** Both are composited — no layout, no
 *    repaint, no main-thread work per frame. The moment something animates
 *    `width`, `height`, `top` or `filter` it stops being free.
 * 2. **One shot, never infinite.** These run on mount or on interaction and
 *    are then over; nothing here contributes to idle cost.
 *
 * Reduced motion is handled centrally by `components/MotionPreference.tsx`,
 * which bridges both the OS `prefers-reduced-motion` setting and this app's
 * own switch into framer's context. Nothing in this file needs to check it.
 */

import type { Transition, Variants } from "framer-motion";

// ─── Primitives ──────────────────────────────────────────────────────────────

/**
 * The house easing. A gentle overshoot at the end, matching the
 * `cubic-bezier(0.34, 1.26, 0.64, 1)` the CSS entrance system already uses, so
 * framer-driven and CSS-driven motion in the same view agree.
 */
export const EASE = [0.34, 1.26, 0.64, 1] as const;

/** Flat ease-out, for things that should arrive without a bounce. */
export const EASE_OUT = [0.22, 0.61, 0.36, 1] as const;

/** Durations, in seconds (framer's unit). Mirrors `--av-dur-*`. */
export const DUR = {
  fast: 0.15,
  base: 0.18,
  slow: 0.25,
} as const;

// ─── Springs ─────────────────────────────────────────────────────────────────

/**
 * The route content stage. Ported verbatim from the aura-soft-ui reference so
 * the two apps move identically — see `components/PageTransition.tsx` for the
 * measurement and for why the rest thresholds are widened.
 */
export const PAGE_TRANSITION_SPRING = {
  type: "spring",
  stiffness: 420,
  damping: 30,
  restDelta: 0.01,
  restSpeed: 0.5,
} as const satisfies Transition;

/**
 * Dialogs. Stiffer and better damped than the page stage: a modal is a direct
 * response to a click and should feel immediate, where a page change is a
 * bigger movement that can afford to breathe.
 */
export const MODAL_SPRING = {
  type: "spring",
  stiffness: 480,
  damping: 34,
  restDelta: 0.01,
  restSpeed: 0.5,
} as const satisfies Transition;

/** Sidebar active-pill travel. Matches the reference's sidebar springs. */
export const NAV_PILL_SPRING = {
  type: "spring",
  stiffness: 450,
  damping: 32,
} as const satisfies Transition;

export const NAV_ACCENT_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 30,
} as const satisfies Transition;

// ─── Variants ────────────────────────────────────────────────────────────────

/** Dialog panel: scale + lift. Paired with `backdropVariants` below. */
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

/**
 * The dim behind a dialog. Opacity only — the blur is a static CSS class, not
 * an animated one, because animating `backdrop-filter` repaints the entire
 * area beneath the overlay every frame.
 */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** A panel that slides in from the right (assistant, print preview). */
export const drawerVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: { opacity: 1, x: 0 },
};

// ─── Staggered lists ─────────────────────────────────────────────────────────

/**
 * How many children a stagger will animate before the rest simply appear.
 *
 * A stagger is a flourish for the first screenful. Applying it to all 664 rows
 * of the spare-parts table would mean the last row waits ~20 seconds to become
 * visible, so the cap is the feature, not a limitation.
 */
export const STAGGER_LIMIT = 12;

/** Per-child delay. Short: this runs on data arriving, not on a splash screen. */
export const STAGGER_STEP = 0.03;

export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER_STEP },
  },
};

export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.slow, ease: EASE_OUT },
  },
};

// ─── Interaction ─────────────────────────────────────────────────────────────

/**
 * Button press feedback. Scale only, and small: a control that moves far under
 * the cursor feels loose, and one that moves at all on hover competes with the
 * colour change already doing that job.
 */
export const TAP = { scale: 0.97 } as const;
export const HOVER_LIFT = { scale: 1.02 } as const;

/** Thumbnail hover, for the image cells in the parts table. */
export const HOVER_ZOOM = { scale: 1.08 } as const;
