"use client";

/**
 * @file components/login/useLoginMotionMode.ts
 * @description One question every login component asks: full motion, or
 * static beauty shot?
 *
 * "static" collapses the load choreography, the ambient drifts, the pointer
 * tilt/parallax and the curtain sweep into their final rendered states — the
 * page is designed to read as a deliberately static premium composition in
 * that mode, not as a broken one.
 *
 * Same merge as `download/useDownloadMotionMode` (kept separate so the two
 * public zones stay independently tunable):
 * - `usePerformance().isLiteMode` — the app's Lite Mode preference OR the OS
 *   `prefers-reduced-motion` setting (already folded together there).
 * - framer's `useReducedMotion()` — additionally catches the in-app motion
 *   switch, which `MotionPreference` forces through `MotionConfig`.
 */

import { useReducedMotion } from "framer-motion";
import { usePerformance } from "@/components/PerformanceProvider";

export type LoginMotionMode = "full" | "static";

export function useLoginMotionMode(): LoginMotionMode {
  const { isLiteMode } = usePerformance();
  const framerReduced = useReducedMotion();
  return isLiteMode || framerReduced ? "static" : "full";
}
