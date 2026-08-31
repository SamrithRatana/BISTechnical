"use client";

/**
 * @file components/docs/useDocsMotionMode.ts
 * @description One question every Docs component asks: full motion, or static
 * beauty shot?
 *
 * "static" collapses the load choreography, the ambient loops, the pointer
 * tilt and the atlas orbit into their final rendered states. The page is
 * designed to read as a deliberately static premium composition in that mode,
 * not as a broken one.
 *
 * Sources merged (identical to `useDownloadMotionMode` — the two public pages
 * answer this the same way on purpose, so a reader who turns motion off gets
 * one consistent product rather than two):
 * - `usePerformance().isLiteMode` — the app's Lite Mode preference OR the OS
 *   `prefers-reduced-motion` setting (already folded together there).
 * - framer's `useReducedMotion()` — additionally catches the in-app motion
 *   switch, which `MotionPreference` forces through `MotionConfig`.
 */

import { useReducedMotion } from "framer-motion";
import { usePerformance } from "@/components/PerformanceProvider";

export type DocsMotionMode = "full" | "static";

export function useDocsMotionMode(): DocsMotionMode {
  const { isLiteMode } = usePerformance();
  const framerReduced = useReducedMotion();
  return isLiteMode || framerReduced ? "static" : "full";
}
