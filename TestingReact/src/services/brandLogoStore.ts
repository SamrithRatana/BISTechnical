"use client";

import { useSyncExternalStore } from "react";

/**
 * @file brandLogoStore.ts
 * @description One `useSyncExternalStore`-shaped source of truth for the
 * uploaded brand logo URL (`localStorage["system_brand_logo"]`).
 *
 * Before this store, Sidebar and the login page each kept their own
 * `useState` + mount-effect + `system_brand_logo_updated`/`storage` listener
 * copy of the same value. That duplication carried two §14 defects the
 * code-review flagged:
 *  - the login page's effect called `setState` synchronously on mount
 *    (`react-hooks/set-state-in-effect`, error level), papered over with an
 *    `isMounted` flag — the exact "isMounted ref hack" §14 forbids;
 *  - Sidebar's `fetchAppLogoUrl().then(setBrandLogo)` had no unmount guard at
 *    all, and Sidebar remounts on every navigation.
 *
 * With the store, components render `useBrandLogo()` and side effects call
 * `publishBrandLogo()` — publishing to module state after an unmount is
 * harmless, so there is nothing left to guard.
 *
 * In-memory `currentLogo` is the authority; `localStorage` is write-through
 * persistence. When storage is blocked (private mode, quota) the app still
 * shows the logo fetched this session — it just does not survive a reload.
 */

const STORAGE_KEY = "system_brand_logo";
/** Legacy event name kept so existing dispatchers keep working unchanged. */
const UPDATED_EVENT = "system_brand_logo_updated";

const listeners = new Set<() => void>();
let currentLogo: string | null = null;
let seededFromStorage = false;

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

/** Snapshot for `useSyncExternalStore`. Seeds from storage once, then serves memory. */
export function getBrandLogoSnapshot(): string | null {
  if (!seededFromStorage) {
    seededFromStorage = true;
    currentLogo = readStorage();
  }
  return currentLogo;
}

/** Server snapshot: the logo is client state, so SSR always renders the fallback mark. */
export function getBrandLogoServerSnapshot(): null {
  return null;
}

export function subscribeBrandLogo(listener: () => void): () => void {
  listeners.add(listener);

  // Cross-source updates: another tab (storage) or a dispatcher that predates
  // this store (ThemeProvider's branding sync fires UPDATED_EVENT).
  const external = () => {
    currentLogo = readStorage();
    listener();
  };
  window.addEventListener(UPDATED_EVENT, external);
  window.addEventListener("storage", external);

  return () => {
    listeners.delete(listener);
    window.removeEventListener(UPDATED_EVENT, external);
    window.removeEventListener("storage", external);
  };
}

/** The one way components read the logo. SSR renders the fallback mark (null). */
export function useBrandLogo(): string | null {
  return useSyncExternalStore(
    subscribeBrandLogo,
    getBrandLogoSnapshot,
    getBrandLogoServerSnapshot
  );
}

/** Sets the logo, persists it best-effort, and notifies every subscriber. */
export function publishBrandLogo(url: string | null): void {
  seededFromStorage = true;
  currentLogo = url;
  try {
    if (url) {
      localStorage.setItem(STORAGE_KEY, url);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Memory already holds the value; persistence is a nicety.
  }
  listeners.forEach((l) => l());
  // Reach the pre-store listeners still bound to the window event.
  try {
    window.dispatchEvent(new Event(UPDATED_EVENT));
  } catch {
    // Non-browser context; subscribers above were already notified.
  }
}
