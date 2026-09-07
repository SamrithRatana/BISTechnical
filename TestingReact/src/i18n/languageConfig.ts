/**
 * @file languageConfig.ts
 * @description The language constants, in a module with no `"use client"`
 * and no dictionary behind it.
 *
 * These used to live in `LanguageProvider.tsx`. They had to move because that
 * file is a client module, and `LanguageScript` — which needs both constants —
 * must be a *server* component to work at all (see `LanguageScript.tsx` for
 * why). A server component cannot import from a `"use client"` module without
 * dragging the whole client boundary along with it, so the shared constants
 * live here instead and both sides import them.
 *
 * `LANGUAGES`, `Language`, `LANGUAGE_LABELS` and `LANGUAGE_SHORT` moved here
 * from `translations.ts` for the same class of reason, one level up: they are
 * a few bytes, but `Header` and `download/DownloadHeader` import them as
 * *values*, and importing any value from `translations.ts` pulls both
 * dictionaries — ~213 KB of string data — into the client bundle. This module
 * has nothing behind it, so those imports now cost what they look like they
 * cost. `translations.ts` re-exports all four, so existing imports still
 * resolve; new client code should import from here.
 */

/** Every language the UI ships. */
export const LANGUAGES = ["en", "km"] as const;

export type Language = (typeof LANGUAGES)[number];

/** Full name, shown in the language menu. */
export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  km: "ខ្មែរ",
};

/** Short code shown in the header's toggle button. */
export const LANGUAGE_SHORT: Record<Language, string> = {
  en: "EN",
  km: "ខ្មែរ",
};

/** localStorage key holding the chosen language. */
export const STORAGE_KEY = "lang";

/** Language used before the user has ever chosen one, and on the server. */
export const DEFAULT_LANGUAGE: Language = "km";
