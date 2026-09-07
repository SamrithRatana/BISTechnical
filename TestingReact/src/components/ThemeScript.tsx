/**
 * @file ThemeScript.tsx
 * @description Stamps the appearance preferences onto <html> before first paint.
 *
 * A synchronous inline script in <head> runs before the browser paints
 * anything, so the very first frame is already correct. No React effect can do
 * this; by the time React commits, the wrong frame is on screen. Same device
 * `LanguageScript` uses for the Khmer/English choice.
 *
 * ── Light/dark, and the part that must not come back ───────────────────────
 *
 * This script resolves the colour scheme and stamps `.dark` on <html> again.
 * It is safe to do so now for a reason worth stating plainly: `globals.css`
 * defines a complete dark palette. The previous removal was not a decision
 * that dark mode is bad — it was that the palette had been deleted while the
 * switch stayed, so `.dark` activated against tokens that no longer existed.
 *
 * What has NOT come back is the clock. The old version resolved dark from the
 * stored mode, the OS setting **and the hour of day**, flipping the theme at
 * 18:00 with configurable day/night boundaries. That is the piece that turned
 * a missing palette into a nightly outage, and `ModeName` in
 * `theme/themeConfig.ts` documents why it is not being reintroduced. Only
 * `light`, `dark` and `system` exist; the OS is the one clock we defer to.
 *
 * Note the ordering constraint this creates: `resolveIsDark` runs here on the
 * stored preference, and again in `ThemeProvider` on the same preference. If
 * the two ever disagreed the pre-paint frame and the first React render would
 * differ and the flash-of-wrong-theme would return — which is precisely why
 * both call the same serialised function rather than each implementing it.
 *
 * ── Why the logic is serialised rather than rewritten ──────────────────────
 *
 * This script and `ThemeProvider` must agree exactly, or the pre-paint frame
 * and the first React render disagree and a flash comes back. So the pure
 * function is injected via `Function.prototype.toString()` instead of being
 * hand-copied into the template: there is exactly one implementation of
 * "which attributes go on <html>", in `theme/themeConfig.ts`, and both paths
 * run it. This is why it is documented as closing over nothing — anything it
 * referenced from module scope would be undefined here.
 *
 * The same constraint applies to a saved custom accent colour: without it,
 * the first frame would paint Aura Velvet's default green, then snap to the
 * user's accent once `ThemeProvider` mounts — the exact flash this file
 * exists to prevent, just for a different token. `theme/accentPalette.ts`'s
 * helpers are NOT one self-contained function like `themeAttributes` —
 * `deriveAccentPalette` calls several others (`adjustLightness`,
 * `pickForeground`, `hexToRgba`, ...) — so every one of them is serialised
 * and injected, each under its own `var` of the same name, so they resolve
 * each other exactly as they do as real module-scope functions.
 */

import {
  DEFAULT_PREFS,
  THEME_PREFS_KEY,
  resolveIsDark,
  themeAttributes,
} from "@/theme/themeConfig";
import {
  accentTokensToCssVars,
  adjustLightness,
  contrastRatio,
  deriveAccentPalette,
  hexToRgb,
  hexToRgba,
  hslToRgb,
  pickForeground,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
} from "@/theme/accentPalette";

export { THEME_PREFS_KEY };

/** Every accent helper that must exist in the injected script's scope, in no particular order — `var` hoisting means call order doesn't matter, only that all are assigned before `deriveAccentPalette` actually runs. */
const ACCENT_HELPERS = {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  adjustLightness,
  relativeLuminance,
  contrastRatio,
  pickForeground,
  hexToRgba,
  deriveAccentPalette,
  accentTokensToCssVars,
};

import Script from "next/script";

export default function ThemeScript() {
  const accentHelperVars = Object.entries(ACCENT_HELPERS)
    .map(([name, fn]) => `var ${name}=${fn.toString()};`)
    .join("\n");

  const js = `(function(){try{
var DEFAULTS=${JSON.stringify(DEFAULT_PREFS)};
var themeAttributes=${themeAttributes.toString()};
var resolveIsDark=${resolveIsDark.toString()};
${accentHelperVars}
var p=DEFAULTS;
var raw=localStorage.getItem(${JSON.stringify(THEME_PREFS_KEY)});
if(raw){
  var parsed=JSON.parse(raw);
  if(parsed&&typeof parsed==='object'){p=Object.assign({},DEFAULTS,parsed);}
}
var root=document.documentElement;
var sysDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
var isDark=resolveIsDark(p.mode,!!sysDark);
if(isDark){root.classList.add('dark');}
else{root.classList.remove('dark');}
var attrs=themeAttributes(p);
for(var k in attrs){root.setAttribute(k,attrs[k]);}
if(p.accentColor){
  var accentVars=accentTokensToCssVars(deriveAccentPalette(p.accentColor,isDark));
  for(var k2 in accentVars){root.style.setProperty(k2,accentVars[k2]);}
  if(accentVars["--av-accent-base"]){
    root.style.setProperty("--accent", accentVars["--av-accent-base"]);
    root.style.setProperty("--accent-hover", accentVars["--av-accent-hover"]);
    root.style.setProperty("--accent-fg", accentVars["--av-accent-fg"]);
    root.style.setProperty("--accent-soft", accentVars["--av-accent-soft"]);
    root.style.setProperty("--accent-soft-fg", accentVars["--av-accent-soft-fg"]);
  }
}
}catch(e){}})();`;

  return <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: js }} />;
}
