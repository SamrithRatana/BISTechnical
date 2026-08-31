"use client";

/**
 * @file components/docs/useAmbientMotion.ts
 * @description Should the ambient loops in this section be running right now?
 *
 * The load choreography is one-shot and always allowed to play; this hook is
 * only about the animations that repeat forever — the atlas float and yaw
 * drift, the orbit chips, the lifecycle pulse. Three things have to be true:
 *
 * 1. **Motion is on at all** — reduced-motion / Lite Mode collapses everything
 *    (`useDocsMotionMode`).
 * 2. **The section is on screen.** A manual is read for minutes, and a loop
 *    animating a hero the reader scrolled past ten screens ago is pure cost:
 *    framer keeps driving it, the compositor keeps painting it, and on a
 *    low-tier machine that is felt in the scrolling of whatever they ARE
 *    reading. `/download` leaves its loops running because it is a page you
 *    skim in thirty seconds; this one is not, so it does not inherit that.
 * 3. **The tab is in front.** A docs page left open in a background tab for an
 *    afternoon should cost nothing at all (§14: the app must be able to run for
 *    weeks without climbing).
 *
 * A margin of `15%` keeps a loop alive slightly beyond the fold, so a reader
 * scrubbing the scrollbar past the hero does not see it visibly stop and start.
 */

import { useInView, usePageInView } from "framer-motion";
import type { RefObject } from "react";
import type { DocsMotionMode } from "./useDocsMotionMode";

export function useAmbientMotion(
  ref: RefObject<Element | null>,
  mode: DocsMotionMode
): boolean {
  const inView = useInView(ref, { margin: "15% 0px" });
  const pageVisible = usePageInView();
  return mode === "full" && inView && pageVisible;
}
