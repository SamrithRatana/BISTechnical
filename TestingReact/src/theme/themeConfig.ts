/**
 * @file theme/themeConfig.ts
 * @description The shape of a user's appearance preferences, and the pure
 * functions that turn them into what gets stamped on <html>.
 *
 * ── What this file no longer does ──────────────────────────────────────────
 *
 * It used to carry seven theme presets, six accents, and four colour modes
 * (`light` / `dark` / `system` / `auto`, the last two resolved against the OS
 * setting and the clock). Aura Velvet replaced all of it: there is one design
 * system, defined once in `app/globals.css`, and colour is no longer a user
 * preference.
 *
 * Removing the *palette* but leaving the machinery would have been worse than
 * either extreme. `resolveIsDark` stamped `.dark` on <html> at 18:00, and 31
 * component files still contain `dark:` utilities — with no dark palette left
 * to back them, the app would have quietly gone half-dark every evening and
 * rendered slate backgrounds against light-system tokens. The switch had to go
 * with the palette.
 *
 * ── What survives ─────────────────────────────────────────────────────────
 *
 * Radius, density, font scale and motion. These are ergonomics, not theming:
 * they exist so a technician on a 1366x768 panel can fit more rows on screen,
 * and so someone can quiet the animations in this app without changing an OS
 * setting. None of them touch colour.
 *
 * Still deliberately plain data and pure functions — no React, no imports.
 * `ThemeScript` serialises `themeAttributes` with `Function.prototype
 * .toString()` and drops the source into an inline <head> script, so it must
 * close over nothing: anything it referenced from module scope would be
 * undefined inside that script.
 */

export type RadiusName = "sharp" | "soft" | "round";
export type DensityName = "comfortable" | "compact";
export type FontScaleName = "sm" | "md" | "lg";
export type MotionName = "full" | "reduced";

/**
 * Light, dark, or whatever the operating system says.
 *
 * **There is deliberately no `auto` here.** The build before Aura Velvet had
 * one: a clock-driven mode with configurable day/night hours that flipped the
 * theme at 18:00. It is the specific reason dark mode had to be torn out
 * rather than merely restyled — `ThemeScript` kept stamping `.dark` every
 * evening after the dark palette was deleted, so the app rendered against
 * tokens that no longer existed, on a timer, with nothing in the UI to
 * explain it. `system` covers the real want (follow the machine) and is a
 * value the OS keeps correct; a second scheduler that can disagree with it is
 * a failure mode, not a feature.
 */
export type ModeName = "light" | "dark" | "system";

export interface ThemePrefs {
  /** Colour scheme. See `ModeName` for why `auto` is not an option. */
  mode: ModeName;
  radius: RadiusName;
  density: DensityName;
  fontScale: FontScaleName;
  /**
   * An in-app motion switch that sits alongside the OS one. `prefers-reduced-
   * motion` already collapses every animation, but that is a system-wide
   * decision; this lets someone quiet down just this app.
   */
  motion: MotionName;
}

export const MODES: ModeName[] = ["light", "dark", "system"];
export const RADII: RadiusName[] = ["sharp", "soft", "round"];
export const DENSITIES: DensityName[] = ["comfortable", "compact"];
export const FONT_SCALES: FontScaleName[] = ["sm", "md", "lg"];
export const MOTIONS: MotionName[] = ["full", "reduced"];

export const DEFAULT_PREFS: ThemePrefs = {
  /**
   * `system` on a first visit, which is what "default to prefers-color-scheme
   * when nothing is saved" means once it is a stored value rather than a
   * special case. A user who picks light or dark explicitly overrides it and
   * that choice persists; nothing silently reverts to following the OS.
   */
  mode: "system",
  radius: "soft",
  density: "comfortable",
  fontScale: "md",
  motion: "full",
};

/** Where the whole preference object lives. */
export const THEME_PREFS_KEY = "ui-prefs";

/**
 * The `data-*` attributes carrying the preferences. CSS does the rest, which is
 * what keeps this cheap: changing density is one attribute write, not a walk
 * over the DOM setting inline styles.
 *
 * Self-contained by contract — see the file header.
 */
export function themeAttributes(prefs: {
  radius: string;
  density: string;
  fontScale: string;
  motion: string;
}): Record<string, string> {
  return {
    "data-radius": prefs.radius,
    "data-density": prefs.density,
    "data-font-scale": prefs.fontScale,
    "data-motion": prefs.motion,
  };
}

/**
 * Whether the dark palette applies, given the preference and what the OS says.
 *
 * Split out from `themeAttributes` rather than folded into it because dark is
 * a **class**, not a `data-*` attribute — `globals.css` declares
 * `@custom-variant dark (&:where(.dark, .dark *))`, and Tailwind's `dark:`
 * variant compiles against that class. Attributes and the class are applied by
 * different calls for that reason.
 *
 * Self-contained by the same contract as `themeAttributes`: `ThemeScript`
 * serialises this function's source into an inline `<head>` script, so it must
 * close over nothing. `systemPrefersDark` is passed in rather than read here
 * because the call sites differ — the inline script uses `matchMedia` directly,
 * the provider subscribes to it.
 */
export function resolveIsDark(mode: string, systemPrefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark;
}

/**
 * Merges whatever was in storage onto the defaults, discarding anything that
 * isn't a value this build knows about.
 *
 * Storage is not trustworthy input: it survives downgrades, it is editable by
 * hand, and a preference written by a later version of the app can name a
 * value this one has no CSS for. Falling back per-field means one unknown
 * value costs that one control, not the whole settings object.
 *
 * Preferences written by the old build carry `preset`, `accent`, `mode`,
 * `dayStartHour` and `nightStartHour`. They are simply not read — an unknown
 * key is dropped by the same mechanism that drops an invalid one, so an
 * upgrade needs no migration step.
 */
export function normalisePrefs(raw: unknown): ThemePrefs {
  const out: ThemePrefs = { ...DEFAULT_PREFS };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;

  if (typeof r.radius === "string" && (RADII as string[]).includes(r.radius)) {
    out.radius = r.radius as RadiusName;
  }
  if (typeof r.density === "string" && (DENSITIES as string[]).includes(r.density)) {
    out.density = r.density as DensityName;
  }
  if (typeof r.fontScale === "string" && (FONT_SCALES as string[]).includes(r.fontScale)) {
    out.fontScale = r.fontScale as FontScaleName;
  }
  if (r.motion === "full" || r.motion === "reduced") {
    out.motion = r.motion;
  }
  if (typeof r.mode === "string" && (MODES as string[]).includes(r.mode)) {
    out.mode = r.mode as ModeName;
  }

  return out;
}
