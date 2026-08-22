"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "@/theme/ThemeProvider";
import { assessDevice, type DeviceAssessment, type DeviceTier } from "@/lib/deviceTier";
import LiteModePrompt from "@/components/LiteModePrompt";

/**
 * @file components/PerformanceProvider.tsx
 * @description Decides whether to OFFER Lite Mode, and exposes whether it is on.
 *
 * ── What this owns, and what it does not ───────────────────────────────────
 *
 * It does not own the setting. Lite Mode is `prefs.lite` in `ThemePrefs`,
 * alongside radius and density, because it has to be stamped on `<html>` before
 * first paint and has to survive a reload — both of which `ThemeScript` and the
 * `ui-prefs` store already do. See `LiteName` in `theme/themeConfig.ts`.
 *
 * What this owns is the *judgement*: run the device assessment once, and if the
 * machine looks like it will struggle, ask. It never switches anything on by
 * itself. A capable machine misread as slow would otherwise silently lose the
 * design with nothing on screen to explain why, and the person would have no
 * idea what to change.
 *
 * ── Why the detection is deferred, not run on mount ────────────────────────
 *
 * The assessment includes a ~600ms frame benchmark. Running that during the
 * first paint of a route means competing with exactly the work it is trying to
 * measure — the reading would be pessimistic on every machine, and the detector
 * would itself be the jank. It is scheduled on `requestIdleCallback` (falling
 * back to a timeout) so it lands after the page has settled.
 *
 * ── `isLiteMode` is not just the preference ────────────────────────────────
 *
 * It is the preference OR the OS reduced-motion setting. Someone who has asked
 * their machine for less motion has already told us it is not a machine to
 * spend frames on, and the brief names `prefers-reduced-motion` as an automatic
 * trigger independent of detection. That direction only: Lite Mode never
 * implies reduced motion in reverse, since a weak GPU and a preference about
 * animation are different statements.
 */

export interface PerformanceContextValue {
  /**
   * Whether to skip decorative work. True when the user has Lite Mode on, or
   * the OS asks for reduced motion.
   *
   * Read this instead of checking either input directly, so a component has one
   * question to ask.
   */
  isLiteMode: boolean;
  /** Turn Lite Mode on or off. Persists through the theme preferences. */
  setLiteMode: (on: boolean) => void;
  /** The measured tier, or null until the assessment has run. */
  tier: DeviceTier | null;
  /** Full assessment, for the Settings diagnostics line. Null until measured. */
  assessment: DeviceAssessment | null;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

/**
 * Remembers that the offer was made, so it is made once per browser rather than
 * on every visit.
 *
 * Separate from `ui-prefs` deliberately: this is not a preference, it is a note
 * that a conversation already happened. Someone who resets their appearance
 * settings should not be re-interrogated about their hardware, and someone who
 * declined should not be asked again — the Settings toggle is where they change
 * their mind.
 */
const PROMPT_SEEN_KEY = "perf-prompt-seen";

function hasBeenAsked(): boolean {
  try {
    return localStorage.getItem(PROMPT_SEEN_KEY) === "1";
  } catch {
    // Storage blocked. Treat as "already asked" rather than asking on every
    // single page load, which would be far worse than never asking.
    return true;
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(PROMPT_SEEN_KEY, "1");
  } catch {
    // Nothing to do; the prompt simply may reappear next session.
  }
}

/** `requestIdleCallback` where it exists, a timeout where it does not (Safari). */
function whenIdle(fn: () => void): () => void {
  const ric = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  }).requestIdleCallback;

  if (typeof ric === "function") {
    const id = ric(fn, { timeout: 4000 });
    return () => (window as Window & { cancelIdleCallback?: (id: number) => void })
      .cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 1500);
  return () => window.clearTimeout(id);
}

export default function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const { prefs, update } = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const [assessment, setAssessment] = useState<DeviceAssessment | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  const setLiteMode = useCallback(
    (on: boolean) => update({ lite: on ? "on" : "off" }),
    [update]
  );

  useEffect(() => {
    // Never ask twice, and never override a choice already made. If Lite Mode
    // is already on there is nothing to offer.
    const alreadyAsked = hasBeenAsked();
    let cancelled = false;

    const cancelIdle = whenIdle(() => {
      void assessDevice().then((result) => {
        // The component may have unmounted during the ~600ms benchmark.
        if (cancelled) return;
        setAssessment(result);
        if (result.tier === "low" && !alreadyAsked && prefs.lite === "off") {
          setPromptOpen(true);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
    // Mount-only: this is a one-shot measurement of the machine, not a live
    // binding to the preference. Re-running it when `prefs.lite` changes would
    // re-offer Lite Mode to someone who just turned it off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChoice = useCallback(
    (accepted: boolean) => {
      markAsked();
      setPromptOpen(false);
      if (accepted) {
        // Both switches, because a machine that failed the frame benchmark
        // wants the animation off as well as the blur. They remain separately
        // adjustable in Settings afterwards.
        update({ lite: "on", motion: "reduced" });
      }
    },
    [update]
  );

  const value = useMemo<PerformanceContextValue>(
    () => ({
      isLiteMode: prefs.lite === "on" || prefersReducedMotion === true,
      setLiteMode,
      tier: assessment?.tier ?? null,
      assessment,
    }),
    [prefs.lite, prefersReducedMotion, setLiteMode, assessment]
  );

  return (
    <PerformanceContext.Provider value={value}>
      {children}
      <LiteModePrompt open={promptOpen} onChoice={handleChoice} />
    </PerformanceContext.Provider>
  );
}

export function usePerformance(): PerformanceContextValue {
  const ctx = useContext(PerformanceContext);
  if (!ctx) throw new Error("usePerformance must be used inside <PerformanceProvider>");
  return ctx;
}
