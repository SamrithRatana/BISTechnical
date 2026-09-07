"use client";

/**
 * @file components/download/useDownloadMotionMode.ts
 * @description One question every download component asks: full motion, or
 * static beauty shot?
 *
 * "static" collapses the load choreography, the ambient loops, the pointer
 * tilt and the scan sequence into their final rendered states — the page is
 * designed to read as a deliberately static premium composition in that mode,
 * not as a broken one.
 *
 * Sources merged:
 * - `usePerformance().isLiteMode` — the app's Lite Mode preference OR the OS
 *   `prefers-reduced-motion` setting (already folded together there).
 * - framer's `useReducedMotion()` — additionally catches the in-app motion
 *   switch, which `MotionPreference` forces through `MotionConfig`.
 */

import { useReducedMotion } from "framer-motion";
import { usePerformance } from "@/components/PerformanceProvider";

export type DownloadMotionMode = "full" | "static";

export function useDownloadMotionMode(): DownloadMotionMode {
  const { isLiteMode } = usePerformance();
  const framerReduced = useReducedMotion();
  return isLiteMode || framerReduced ? "static" : "full";
}
