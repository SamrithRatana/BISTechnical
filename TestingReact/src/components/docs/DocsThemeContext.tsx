"use client";

/**
 * @file components/docs/DocsThemeContext.tsx
 * @description The one place /docs keeps its light/dark choice.
 *
 * This page owns its own theme, on the same footing as /login and /download:
 * a public surface deliberately outside the `--av-*` token system, whose
 * shipped default is DARK regardless of what the signed-in user prefers
 * everywhere else.
 *
 * Before this file existed there were TWO answers to "is the manual dark", and
 * they agreed only by luck. The page shell held the preference in a `useState`
 * seeded from `localStorage["docs_theme_mode"]` — unset means dark — while
 * every child component read `isDark` from the GLOBAL `theme/ThemeProvider`,
 * whose own default is `mode: "system"`, i.e. whatever the OS says. So a
 * first-time visitor on a light-mode machine got the shell's dark background
 * underneath children that had each independently decided the page was light:
 * white text on white cards, measured at 1.0:1. The shell also *wrote* to the
 * global provider on toggle, so reading the documentation silently re-themed
 * the rest of the application.
 *
 * One context, read by the shell and by every child, makes that disagreement
 * unrepresentable. Docs components import `useDocsTheme` from here and never
 * `@/theme/ThemeProvider`.
 *
 * Built as an external store read through `useSyncExternalStore`, deliberately
 * matching `theme/ThemeProvider` rather than inventing a second shape for the
 * same problem: both persist a preference in localStorage, both must survive
 * SSR without a hydration mismatch, and both have to follow a change made in
 * another tab.
 *
 * What it deliberately does NOT do: touch `document.documentElement.classList`
 * or call the global provider's `update()`. Visiting /docs must leave the rest
 * of the app's appearance exactly as it found it — the old shell effect added
 * `.dark` to <html> with no cleanup, so the class outlived the route.
 */

import React, { createContext, useCallback, useContext, useMemo } from "react";
import { useSyncExternalStore } from "react";

export interface DocsThemeValue {
  isDark: boolean;
  toggle: () => void;
}

const DocsThemeContext = createContext<DocsThemeValue | null>(null);

/** Its own key, so resetting app appearance never re-themes the manual. */
const DOCS_THEME_KEY = "docs_theme_mode";

/** The shipped product decision: the manual opens DARK. */
const DEFAULT_IS_DARK = true;

// ─── External store over localStorage ────────────────────────────────────────

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Mirrors the last write so the toggle still works where storage is refused.
 *
 * `ThemeProvider` can afford to ignore this case because it also writes the
 * resolved theme onto <html>, so the session keeps working from the DOM. Here
 * localStorage is the only source of truth, and without a fallback a browser
 * that throws would leave the toggle doing nothing at all, silently.
 */
let memoryRaw: string | null = null;
let storageUsable = true;

function readRaw(): string | null {
  if (!storageUsable) return memoryRaw;
  try {
    return localStorage.getItem(DOCS_THEME_KEY);
  } catch {
    // Private-mode Safari throws on localStorage. A preference is never worth
    // breaking the page over.
    storageUsable = false;
    return memoryRaw;
  }
}

/** Anything that is not an explicit `"light"`/`"dark"` resolves to the default. */
function parseIsDark(raw: string | null): boolean {
  if (raw === "light") return false;
  if (raw === "dark") return true;
  return DEFAULT_IS_DARK;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);

  // `storage` only fires in *other* tabs, which is exactly the case local
  // emits don't cover.
  const onStorage = (e: StorageEvent) => {
    if (e.key === DOCS_THEME_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The raw stored string, not the resolved boolean — a stable primitive. */
function getSnapshot(): string | null {
  return readRaw();
}

function getServerSnapshot(): string | null {
  // The server has no localStorage, so it renders the default. React reuses
  // this value for the hydrating render too, so the two cannot disagree.
  return null;
}

function writeIsDark(next: boolean) {
  const raw = next ? "dark" : "light";
  memoryRaw = raw;
  try {
    localStorage.setItem(DOCS_THEME_KEY, raw);
  } catch {
    storageUsable = false;
  }
  emit();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function DocsThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = parseIsDark(raw);

  /**
   * Reads storage rather than closing over `isDark`, so the callback keeps one
   * identity for the life of the page and can never flip from a stale value.
   */
  const toggle = useCallback(() => {
    writeIsDark(!parseIsDark(readRaw()));
  }, []);

  const value = useMemo(() => ({ isDark, toggle }), [isDark, toggle]);

  return <DocsThemeContext.Provider value={value}>{children}</DocsThemeContext.Provider>;
}

export function useDocsTheme(): DocsThemeValue {
  const ctx = useContext(DocsThemeContext);
  if (!ctx) throw new Error("useDocsTheme must be used inside <DocsThemeProvider>");
  return ctx;
}
