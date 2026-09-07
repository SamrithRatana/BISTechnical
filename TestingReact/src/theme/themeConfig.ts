/**
 * @file theme/themeConfig.ts
 * @description The shape of a user's appearance preferences, and the pure
 * functions that turn them into what gets stamped on <html>.
 *
 * ── What this file no longer does ──────────────────────────────────────────
 *
 * It used to carry seven theme presets, six accents, and four colour modes
 * (`light` / `dark` / `system` / `auto`, the last two resolved against the OS
 * setting and the clock). Aura Velvet replaced all of it with one design
 * system, defined once in `app/globals.css`.
 *
 * Removing the *palette* but leaving the machinery would have been worse than
 * either extreme. `resolveIsDark` stamped `.dark` on <html> at 18:00, and 31
 * component files still contain `dark:` utilities — with no dark palette left
 * to back them, the app would have quietly gone half-dark every evening and
 * rendered slate backgrounds against light-system tokens. The switch had to go
 * with the palette. That is still true, and the `auto`/clock mode is still
 * gone for the same reason — see `ModeName` below.
 *
 * ── Accent colour is back, deliberately ──────────────────────────────────
 *
 * This file used to say "colour is no longer a user preference" — one
 * component library, one accent, no picker. That held until branding
 * customization (Settings → Theme & Branding) was requested explicitly and in
 * detail: curated swatches, a custom hex picker, a colour suggested from the
 * user's profile photo, all applying live. `accentColor` and `surfaceStyle`
 * below are that preference, re-added on purpose. What's unchanged from the
 * paragraph above: there is still exactly ONE design system, and this is one
 * more override token pair on top of it (`--av-accent-*`, applied by
 * `ThemeProvider`'s `applyToDocument` — see `theme/accentPalette.ts`), not a
 * second palette to keep in sync. `null` (the default) means "use Aura
 * Velvet's own accent," so a user who never opens Settings sees no change at
 * all.
 *
 * ── What else survives ───────────────────────────────────────────────────
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
 * Card/panel elevation treatment. `cushion` is Aura Velvet's current default
 * (soft multi-layer shadow + inset highlight); `glass` and `flat` are the
 * other two ends of the same spectrum — see the `[data-surface-style]` block
 * in `globals.css` for what each actually sets.
 */
export type SurfaceStyleName = "cushion" | "glass" | "flat";
export type CommandPaletteStyle = "glass" | "solid" | "tinted" | "acrylic";
export type SidebarStyleName =
  | "classic"
  | "compact-rail"
  | "enterprise-erp"
  | "floating"
  | "dual-column"
  | "carbon"
  | "radiant"
  | "motion-expansion";

export type CrudStyleName =
  | "modern-inline"
  | "enterprise-ribbon"
  | "split-workbench"
  | "compact-pos";

/**
 * Lite Mode: strip the expensive *visual* effects, keep every feature.
 *
 * A preference here rather than its own context+storage key, and that is the
 * whole design. Lite Mode has to be on the very first frame — a low-end machine
 * painting one blurred, shadowed frame and then dropping it is the exact
 * stutter it exists to avoid — and `ThemeScript` already stamps this object
 * pre-paint. It also has to survive a reload and sync across tabs, which
 * `ui-prefs` already does. A parallel system would have re-solved all three
 * badly.
 *
 * Distinct from `motion` on purpose. `motion: "reduced"` collapses animation;
 * this drops `backdrop-filter`, layered shadows and 3D transforms, which cost
 * on every *paint* whether or not anything is moving. A weak GPU with a fast
 * CPU wants this and not necessarily that; someone who finds animation
 * distracting wants that and not this. `PerformanceProvider` turns both on
 * together when it detects a low-tier device, because that device wants both —
 * but they stay separately controllable in Settings.
 */
export type LiteName = "off" | "on";

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
  /**
   * A user-chosen accent, as a 6-digit hex string (`#rrggbb`). `null` (the
   * default) means "use Aura Velvet's own accent" — see the file header.
   */
  accentColor: string | null;
  surfaceStyle: SurfaceStyleName;
  /** Command Palette / Spotlight visual theme style */
  commandPaletteStyle: CommandPaletteStyle;
  /** Sidebar visual layout & UX style */
  sidebarStyle: SidebarStyleName;
  /** CRUD Table & Tool layout style (modern inline, enterprise ribbon, split workbench, compact POS) */
  crudStyle: CrudStyleName;
  /**
   * Logo zoom/scale percentage (e.g. 100 to 250, default 130).
   * Allows scaling wide or margin-heavy logos to fit the frame nicely.
   */
  logoScale: number;
  /**
   * Drop blur, layered shadows and 3D transforms. See `LiteName` for why this
   * is separate from `motion`, and why it lives in this object.
   */
  lite: LiteName;
}

export const MODES: ModeName[] = ["light", "dark", "system"];
export const RADII: RadiusName[] = ["sharp", "soft", "round"];
export const DENSITIES: DensityName[] = ["comfortable", "compact"];
export const FONT_SCALES: FontScaleName[] = ["sm", "md", "lg"];
export const MOTIONS: MotionName[] = ["full", "reduced"];
export const SURFACE_STYLES: SurfaceStyleName[] = ["cushion", "glass", "flat"];
export const COMMAND_PALETTE_STYLES: CommandPaletteStyle[] = ["glass", "solid", "tinted", "acrylic"];
export const SIDEBAR_STYLES: SidebarStyleName[] = [
  "classic",
  "compact-rail",
  "enterprise-erp",
  "floating",
  "dual-column",
  "carbon",
  "radiant",
  "motion-expansion",
];
export const CRUD_STYLES: CrudStyleName[] = [
  "modern-inline",
  "enterprise-ribbon",
  "split-workbench",
  "compact-pos",
];
export const LITE_MODES: LiteName[] = ["off", "on"];

/** 6-digit hex only (`#rrggbb`) — what `deriveAccentPalette` expects. */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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
  accentColor: null,
  surfaceStyle: "cushion",
  commandPaletteStyle: "glass",
  sidebarStyle: "classic",
  crudStyle: "enterprise-ribbon",
  logoScale: 130,
  /**
   * Off by default, and never turned on without asking. Detection decides
   * whether to *offer* Lite Mode; the person decides whether to take it. A
   * capable machine misread as slow would otherwise silently lose the design
   * with nothing on screen to explain it.
   */
  lite: "off",
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
  surfaceStyle: string;
  commandPaletteStyle?: string;
  sidebarStyle?: string;
  crudStyle?: string;
  lite: string;
}): Record<string, string> {
  return {
    "data-radius": prefs.radius,
    "data-density": prefs.density,
    "data-font-scale": prefs.fontScale,
    "data-motion": prefs.motion,
    "data-surface-style": prefs.surfaceStyle,
    "data-cmd-palette-style": prefs.commandPaletteStyle || "glass",
    "data-sidebar-style": prefs.sidebarStyle || "classic",
    "data-crud-style": prefs.crudStyle || "modern-inline",
    "data-lite": prefs.lite,
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
  if (typeof r.surfaceStyle === "string" && (SURFACE_STYLES as string[]).includes(r.surfaceStyle)) {
    out.surfaceStyle = r.surfaceStyle as SurfaceStyleName;
  }
  if (typeof r.commandPaletteStyle === "string" && (COMMAND_PALETTE_STYLES as string[]).includes(r.commandPaletteStyle)) {
    out.commandPaletteStyle = r.commandPaletteStyle as CommandPaletteStyle;
  }
  if (typeof r.sidebarStyle === "string" && (SIDEBAR_STYLES as string[]).includes(r.sidebarStyle)) {
    out.sidebarStyle = r.sidebarStyle as SidebarStyleName;
  }
  if (typeof r.crudStyle === "string" && (CRUD_STYLES as string[]).includes(r.crudStyle)) {
    out.crudStyle = r.crudStyle as CrudStyleName;
  }
  if (r.lite === "off" || r.lite === "on") {
    out.lite = r.lite;
  }
  if (typeof r.logoScale === "number" && r.logoScale >= 60 && r.logoScale <= 300) {
    out.logoScale = Math.round(r.logoScale);
  }
  if (r.accentColor === null) {
    out.accentColor = null;
  } else if (typeof r.accentColor === "string" && HEX_COLOR_PATTERN.test(r.accentColor)) {
    out.accentColor = r.accentColor;
  }

  return out;
}
