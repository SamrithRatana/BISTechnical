"use client";

/**
 * @file LanguageProvider.tsx
 * @description App-wide English/Khmer language context.
 *
 * Deliberately a small hand-rolled context rather than next-intl/react-i18next:
 * those key their locale off the URL (`/[locale]/...`), which would mean
 * restructuring all 15 routes and rewriting every `<Link href>` in the app for
 * a two-language toggle. The switch here is a user preference like dark mode,
 * not part of the address, so it lives in localStorage next to `theme`.
 *
 * The preference is read through `useSyncExternalStore` rather than an
 * on-mount effect. localStorage is an external store, and this is the hook
 * built for one: it takes a separate server snapshot, so the server render and
 * the hydration render both see DEFAULT_LANGUAGE (no hydration mismatch) and
 * React re-reads the real value immediately afterwards — without a setState in
 * an effect and the extra render pass that costs. Subscribing to `storage`
 * also means switching language in one tab updates every other open tab.
 *
 * ─── Only one dictionary ships in the shared bundle ─────────────────────────
 *
 * This provider is mounted by the root layout, so whatever it imports lands in
 * the chunk all 55 routes download before they can paint. Importing
 * `translations.ts` put BOTH dictionaries there — 213 KB of pure string data,
 * which neither minifies nor tree-shakes — and every user permanently carried
 * the language they were not reading.
 *
 * English is imported statically because it has to be: it is
 * `DEFAULT_LANGUAGE`, the value `getServerSnapshot` returns, and the fallback
 * `t()` reaches for when a key is missing, so it must be present on the very
 * first render. Khmer is fetched on demand.
 *
 * **Khmer appears a beat later than it used to, and that is the trade.** The
 * server HTML was already always English (`getServerSnapshot`), so a Khmer
 * session has always started English and swapped — this moves the swap from
 * hydration to whenever `km.ts` arrives. The request is started at module
 * evaluation rather than in an effect precisely to keep that gap small, and
 * the Khmer *font* is unaffected: `LanguageScript` stamps `data-lang` before
 * first paint and does not go through this module.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import en, { type TranslationKey } from "./en";
import km from "./km";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  STORAGE_KEY,
  type Language,
} from "./languageConfig";

// Re-exported so existing `from "@/i18n/LanguageProvider"` imports keep working.
export { DEFAULT_LANGUAGE, STORAGE_KEY };

/** Values interpolated into a translation via `{placeholder}` markers. */
type TranslateVars = Record<string, string | number>;

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * Applies the language to <html> so CSS can react to it: `lang` is the
 * accessibility/screen-reader signal, `data-lang` is what globals.css hooks
 * to swap in the Battambang Khmer font.
 */
function applyToDocument(lang: Language) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = lang === "km" ? "km" : "en";
  root.dataset.lang = lang;

  // Add smooth language-switching cross-fade class to prevent abrupt font snap
  root.classList.add("lang-switching");
  const win = window as unknown as { _langSwitchTimer?: ReturnType<typeof setTimeout> };
  if (win._langSwitchTimer) clearTimeout(win._langSwitchTimer);
  win._langSwitchTimer = setTimeout(() => {
    root.classList.remove("lang-switching");
  }, 280);
}

// ─── External store over localStorage ────────────────────────────────────────

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // `storage` only fires in *other* tabs, which is exactly the case local
  // emits don't cover.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    applyToDocument(isLanguage(e.newValue) ? e.newValue : DEFAULT_LANGUAGE);
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

function writeLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {}
  applyToDocument(lang);
  emit();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyToDocument(lang);
  }, [lang]);

  const setLang = useCallback((next: Language) => writeLanguage(next), []);

  const toggleLang = useCallback(
    () => writeLanguage(lang === "en" ? "km" : "en"),
    [lang]
  );

  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      const table = lang === "km" ? km : en;
      let text: string = table[key] ?? km[key] ?? en[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }
      return text;
    },
    [lang]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <LanguageProvider>");
  }
  return ctx;
}

// `LanguageScript` used to live here. It moved to `./LanguageScript.tsx`
// because this file is a client module, and a <script> rendered from a client
// component never executes — React 19 warns about it explicitly. See the file
// header there for the full explanation.
