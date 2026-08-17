"use client";

/**
 * @file theme/ThemeProvider.tsx
 * @description Owns appearance preferences at runtime and keeps <html> in sync.
 *
 * `ThemeScript` has already stamped the preferences before first paint, so this
 * provider is never responsible for the *first* frame — only for changes after
 * it. That split is what removes the flash: an effect cannot run before paint,
 * so anything that must be right immediately belongs in the inline script, and
 * anything that reacts belongs here.
 *
 * Built as an external store read through `useSyncExternalStore`, deliberately
 * matching `i18n/LanguageProvider` rather than inventing a second shape for the
 * same problem. Both persist a preference in localStorage, both must survive
 * SSR without a hydration mismatch, and both need to follow changes made in
 * another tab.
 *
 * The `matchMedia` listener and the hour-aligned timer that used to live in
 * `subscribe` are gone with dark mode — they existed only to re-resolve
 * light/dark when the OS setting flipped or the clock crossed 18:00. Nothing
 * left here changes on its own, so the only remaining source of change is a
 * write: this tab's (`writePrefs` emits) or another tab's (`storage`).
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFS,
  THEME_PREFS_KEY,
  normalisePrefs,
  resolveIsDark,
  themeAttributes,
  type ThemePrefs,
} from "./themeConfig";

interface ThemeContextValue {
  prefs: ThemePrefs;
  /** Patch one or more preferences; the rest are left alone. */
  update: (patch: Partial<ThemePrefs>) => void;
  /** Restore every preference to its shipped default. */
  reset: () => void;
  /**
   * Whether the dark palette is currently applied — `prefs.mode` resolved
   * against the OS setting.
   *
   * Exposed because `mode` alone cannot answer "is it dark right now": under
   * `system` the answer lives in `matchMedia`. A toggle button that renders a
   * sun or a moon needs the resolved value, not the preference.
   */
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── External store over localStorage ────────────────────────────────────────

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(THEME_PREFS_KEY);
  } catch {
    // Private-mode Safari throws on localStorage. A preference is never worth
    // breaking the page over.
    return null;
  }
}

function parsePrefs(raw: string | null): ThemePrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    return normalisePrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_PREFS;
  }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/**
 * Writes the preferences onto <html>. The single place that touches the DOM.
 *
 * The `.dark` class is applied here and the ergonomics as `data-*` attributes,
 * because `globals.css` compiles Tailwind's `dark:` variant against the class
 * (`@custom-variant dark (&:where(.dark, .dark *))`). Same split as
 * `ThemeScript`, and both call `resolveIsDark` so they cannot disagree.
 *
 * Guarded against a no-op write: the theme cross-fade below is driven by a
 * class on <html>, and re-adding a class the element already has would restart
 * the transition on every unrelated preference change.
 */
function applyToDocument(prefs: ThemePrefs) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeAttributes(prefs))) {
    root.setAttribute(name, value);
  }

  const shouldBeDark = resolveIsDark(prefs.mode, systemPrefersDark());
  if (shouldBeDark !== root.classList.contains("dark")) {
    root.classList.toggle("dark", shouldBeDark);
  }
}

/**
 * Cross-fades the palette, then takes the transition back off.
 *
 * The 200ms colour transition is opt-in via `.av-theme-transition` rather than
 * being a permanent rule on `*`. Left on, it would animate the colour of every
 * element for every other reason a colour changes — table row hover, focus
 * rings, badge state — turning 150ms interaction feedback into a 200ms smear
 * across the entire document.
 *
 * The timeout is 50ms longer than the transition so the class outlives it; a
 * class removed at exactly 200ms can cut the final frame short on a busy main
 * thread.
 */
let themeFadeTimer: number | undefined;

function withThemeFade(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("av-theme-transition");
  apply();

  window.clearTimeout(themeFadeTimer);
  themeFadeTimer = window.setTimeout(() => {
    root.classList.remove("av-theme-transition");
  }, 250);
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  // `storage` only fires in *other* tabs, which is exactly the case local
  // emits don't cover.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_PREFS_KEY) {
      withThemeFade(() => applyToDocument(parsePrefs(readRaw())));
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);

  /**
   * Follow the OS while `mode` is `system`.
   *
   * This listener is back after being removed with the old dark mode, but only
   * half of what was there: the hour-aligned timer that flipped the theme at
   * 18:00 is gone for good (see `ModeName` in `themeConfig.ts`). `matchMedia`
   * is a real external signal about what the user wants; a clock is a guess.
   *
   * It re-reads from storage rather than closing over prefs so that it cannot
   * act on a stale `mode` — and `resolveIsDark` ignores the system value
   * entirely unless the mode is `system`, so no guard is needed here.
   */
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    withThemeFade(() => applyToDocument(parsePrefs(readRaw())));
    onStoreChange();
  };
  media.addEventListener("change", onSystemChange);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onSystemChange);
  };
}

/**
 * Returns the raw JSON string, not the parsed object.
 *
 * `useSyncExternalStore` compares snapshots with `Object.is` and re-renders
 * whenever they differ. A fresh object every call never equals the last one, so
 * returning parsed prefs here would loop forever. A string settles.
 */
function getPrefsSnapshot(): string | null {
  return readRaw();
}

function getPrefsServerSnapshot(): string | null {
  return null; // The server has no localStorage; it renders the defaults.
}

/**
 * A second store, for the OS colour-scheme setting.
 *
 * Separate from the preferences store because it is a separate source of
 * truth, and because the preferences snapshot cannot represent it: that
 * snapshot is the localStorage string, which does not change when the OS flips
 * from light to dark. Subscribing to `matchMedia` inside `subscribe` above is
 * enough to keep the DOM correct, but React would never re-render, so anything
 * rendering *from* the resolved value — the toggle's icon — would go stale.
 */
function subscribeSystemDark(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSystemDarkSnapshot(): boolean {
  return systemPrefersDark();
}

function getSystemDarkServerSnapshot(): boolean {
  return false; // No `matchMedia` on the server; assume light and re-resolve on the client.
}

function writePrefs(next: ThemePrefs) {
  try {
    localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(next));
  } catch {
    // Preference still applies for this session; it just won't persist.
  }
  withThemeFade(() => applyToDocument(next));
  emit();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getPrefsSnapshot, getPrefsServerSnapshot);

  const prefs = useMemo(() => parsePrefs(raw), [raw]);

  const update = useCallback((patch: Partial<ThemePrefs>) => {
    writePrefs({ ...parsePrefs(readRaw()), ...patch });
  }, []);

  const reset = useCallback(() => writePrefs(DEFAULT_PREFS), []);

  const sysDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDarkSnapshot,
    getSystemDarkServerSnapshot
  );
  const isDark = resolveIsDark(prefs.mode, sysDark);

  const value = useMemo(
    () => ({ prefs, update, reset, isDark }),
    [prefs, update, reset, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
