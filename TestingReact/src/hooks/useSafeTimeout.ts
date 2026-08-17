"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * @file hooks/useSafeTimeout.ts
 * @description `setTimeout` that cannot outlive the component that scheduled it.
 *
 * ── The bug this prevents ──────────────────────────────────────────────────
 *
 * Several places scheduled a timer whose callback touches component state:
 *
 *     const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000); };
 *     setTimeout(onClose, 800);                       // after a successful save
 *
 * Navigate away inside that window — 3 seconds is a long time on a queue page,
 * and every sidebar click now runs a ~230ms exit animation first — and the
 * timer still fires against a component React has already unmounted. Each one
 * is small: a no-op state write, and a closure keeping the component's scope
 * (and everything it captured) alive until it fires. But this app is left open
 * for a whole shift, and the pages that do it are the ones people move between
 * all day.
 *
 * `AiLauncher` already solved this locally with a `Set` of timer ids cleared on
 * unmount. This is that pattern extracted, so the other five call sites get it
 * without each re-implementing it — and so there is one place to look when the
 * next one appears.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *
 *     const later = useSafeTimeout();
 *     later(() => setToastMsg(null), 3000);
 *
 * Returns a stable function, so it is safe in a `useCallback` dependency list
 * and will not re-create the callbacks that close over it.
 */
export function useSafeTimeout(): (fn: () => void, ms: number) => void {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    // Captured into a local so the cleanup reads the same Set the effect saw,
    // rather than whatever `.current` happens to be at teardown.
    const pending = timers.current;
    return () => {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    };
  }, []);

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      // Drop the id before running, so a long-lived component that schedules
      // many timers does not accumulate dead ids in the Set for its lifetime.
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
}
