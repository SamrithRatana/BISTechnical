"use client";

/**
 * @file useSearchQueryParam.ts
 * @description Applies a `?q=` URL parameter to a page's own search box, so
 * arriving from the header's global search lands on the ticket you picked.
 *
 * Reads on mount via an effect rather than during render: seeding useState
 * directly from window.location would differ between the server-rendered
 * markup (no window, empty string) and the first client render, producing a
 * hydration mismatch on the input. Also avoids next/navigation's
 * useSearchParams, which forces the whole page under a Suspense boundary at
 * build time.
 */

import { useEffect } from "react";

export function useSearchQueryParam(apply: (value: string) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) apply(q);
    // Runs once on mount: this seeds the initial term, and must not fight the
    // user's own typing afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
