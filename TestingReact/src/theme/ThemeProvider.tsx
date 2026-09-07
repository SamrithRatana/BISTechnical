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

import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { useSyncExternalStore } from "react";
import {
  DEFAULT_PREFS,
  THEME_PREFS_KEY,
  normalisePrefs,
  resolveIsDark,
  themeAttributes,
  type ThemePrefs,
} from "./themeConfig";
import { accentTokensToCssVars, deriveAccentPalette } from "./accentPalette";
import { fetchGlobalBranding, updateGlobalBranding, fetchUserThemePreferences, updateUserThemePreferences } from "@/services/appSettings";
import { subscribeToSession } from "@/services/authSession";

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
/** Every `--av-accent-*` custom property `deriveAccentPalette` can set, for clearing. */
const ACCENT_CSS_VARS = [
  "--av-accent-base",
  "--av-accent-bright",
  "--av-accent-hover",
  "--av-accent-fg",
  "--av-accent-soft",
  "--av-accent-soft-fg",
  "--av-accent-glow",
  "--av-accent-ring",
  "--accent",
  "--accent-hover",
  "--accent-fg",
  "--accent-soft",
  "--accent-soft-fg",
];

function applyToDocument(prefs: ThemePrefs) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeAttributes(prefs))) {
    root.setAttribute(name, value);
  }

  const shouldBeDark = resolveIsDark(prefs.mode, systemPrefersDark());
  if (shouldBeDark !== root.classList.contains("dark")) {
    root.classList.toggle("dark", shouldBeDark);
  }

  /**
   * A custom accent overrides the design system's own `--av-accent-*` tokens
   * via inline style, which wins over the class-scoped `:root`/`.dark` rules
   * regardless of which palette is active — one code path for both themes.
   * `null` means "use Aura Velvet's own accent," so every property is
   * cleared back to whatever the token block defines.
   */
  if (prefs.accentColor) {
    const vars = accentTokensToCssVars(deriveAccentPalette(prefs.accentColor, shouldBeDark));
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.style.setProperty("--accent", vars["--av-accent-base"]);
    root.style.setProperty("--accent-hover", vars["--av-accent-hover"]);
    root.style.setProperty("--accent-fg", vars["--av-accent-fg"]);
    root.style.setProperty("--accent-soft", vars["--av-accent-soft"]);
    root.style.setProperty("--accent-soft-fg", vars["--av-accent-soft-fg"]);
  } else {
    for (const name of ACCENT_CSS_VARS) {
      root.style.removeProperty(name);
    }
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
let typeFadeTimer: number | undefined;

/**
 * The typography tween — `letter-spacing` and `line-height` — on the same
 * opt-in terms as the colour cross-fade above, and for a sharper reason.
 *
 * `globals.css` used to declare it unconditionally on
 * `h1..h6, p, span, label, button, a, td, th`, which measured **185 elements
 * carrying a live transition** on a single page. Both properties trigger
 * LAYOUT, so that is a standing invitation to animate reflow on any recalc
 * that touches them — precisely what the project's "animate transform and
 * opacity only" rule exists to prevent.
 *
 * It is only ever wanted when the user changes font scale or density, so it is
 * added for that and taken straight back off.
 */
function withTypeFade() {
  const root = document.documentElement;
  root.classList.add("av-type-transition");
  window.clearTimeout(typeFadeTimer);
  typeFadeTimer = window.setTimeout(() => {
    root.classList.remove("av-type-transition");
  }, 230);
}

function withThemeFade(apply: () => void) {
  const root = document.documentElement;
  root.classList.add("av-theme-transition");
  apply();

  window.clearTimeout(themeFadeTimer);
  themeFadeTimer = window.setTimeout(() => {
    root.classList.remove("av-theme-transition");
  }, 190);
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
 */
function getPrefsSnapshot(): string | null {
  return readRaw();
}

function getPrefsServerSnapshot(): string | null {
  return null; // The server has no localStorage; it renders the defaults.
}

/**
 * A second store, for the OS colour-scheme setting.
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
  return false;
}

/**
 * Whether two preference sets are the same.
 *
 * Compared field by field rather than by `JSON.stringify`, so the answer does
 * not depend on key order — `update()` builds its object by spreading a patch
 * over the current prefs, which is not necessarily the order `normalisePrefs`
 * produces.
 */
function prefsEqual(a: ThemePrefs, b: ThemePrefs): boolean {
  const keys = Object.keys({ ...a, ...b }) as (keyof ThemePrefs)[];
  return keys.every((k) => a[k] === b[k]);
}

function writePrefs(next: ThemePrefs) {
  const prev = parsePrefs(readRaw());

  /**
   * A write that changes nothing costs as much as one that changes everything,
   * so it has to be skipped rather than merely tolerated. `applyToDocument`
   * invalidates styles on `<html>`, and `withThemeFade` puts
   * `.av-theme-transition` on the root — which this project has measured at
   * ~630ms of style recalculation on `/spareparts`, because the cross-fade
   * selector reaches every element on the page.
   *
   * The caller that made this matter is the theme sync in `ThemeProvider`: it
   * runs on every full page load and re-applies whatever the server has
   * stored, which is almost always exactly what is already on screen. That was
   * a document-wide recalc plus a global 180ms transition on every load, for a
   * no-op.
   */
  if (prefsEqual(prev, next)) return;

  const typographyChanged =
    prev.fontScale !== next.fontScale || prev.density !== next.density;

  try {
    localStorage.setItem(THEME_PREFS_KEY, JSON.stringify(next));
  } catch {
    // Preference still applies for this session; it just won't persist.
  }
  if (typographyChanged) withTypeFade();
  withThemeFade(() => applyToDocument(next));
  emit();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, getPrefsSnapshot, getPrefsServerSnapshot);

  const prefs = useMemo(() => parsePrefs(raw), [raw]);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((patch: Partial<ThemePrefs>) => {
    const current = parsePrefs(readRaw());
    const next = { ...current, ...patch };
    writePrefs(next);

    // Sync individual user's theme preferences to SQL Server with 300ms debounce
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      updateUserThemePreferences(JSON.stringify(next)).catch(() => {});
      if (patch.logoScale !== undefined) {
        updateGlobalBranding({ logoScale: patch.logoScale }).catch(() => {});
      }
    }, 300);
  }, []);

  const reset = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    writePrefs(DEFAULT_PREFS);
    updateUserThemePreferences(JSON.stringify(DEFAULT_PREFS)).catch(() => {});
  }, []);

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

  // Apply theme tokens to document immediately upon initial mount and on every prefs change
  React.useEffect(() => {
    applyToDocument(prefs);
  }, [prefs]);

  // Cleanup pending sync timer on unmount
  React.useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // Sync with authenticated user's personal theme and global company branding.
  // Runs on mount AND whenever the session changes: this provider sits in the
  // root layout above AuthGuard, so it mounts once per full page load — before
  // the fix, a user signing in via the soft `router.push("/")` never got their
  // saved theme until a manual reload, because the mount-time fetch had already
  // run (and been skipped) while signed out.
  React.useEffect(() => {
    let inFlight = false;
    let lastFetched = 0;

    const syncUserTheme = () => {
      const now = Date.now();
      if (inFlight || now - lastFetched < 2000) return;
      inFlight = true;
      lastFetched = now;

      fetchUserThemePreferences()
        .then((userThemeJson) => {
          if (userThemeJson) {
            try {
              const userSavedPrefs = parsePrefs(userThemeJson);
              writePrefs(userSavedPrefs);
            } catch {}
          }
        })
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };

    syncUserTheme();
    // Signed-out mounts no-op above (the service guards on the token), then
    // this re-runs the moment login stores one. Logout also fires it; the
    // guard turns that into a no-op rather than a 401.
    const unsubscribe = subscribeToSession(syncUserTheme);

    // Fetch global company logo branding
    fetchGlobalBranding().then((globalBranding) => {
      if (!globalBranding) return;
      if (globalBranding.logoUrl) {
        const storedLogo = localStorage.getItem("system_brand_logo");
        if (storedLogo !== globalBranding.logoUrl) {
          localStorage.setItem("system_brand_logo", globalBranding.logoUrl);
          window.dispatchEvent(new Event("system_brand_logo_updated"));
        }
      }
    }).catch(() => {});

    return unsubscribe;
  }, []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
