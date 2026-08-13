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
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  LANGUAGES,
  translations,
  type Language,
  type TranslationKey,
} from "./translations";

export const STORAGE_KEY = "lang";
export const DEFAULT_LANGUAGE: Language = "en";

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
  const root = document.documentElement;
  root.lang = lang === "km" ? "km" : "en";
  root.dataset.lang = lang;
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
  // Returns a primitive, so React's Object.is check settles even though this
  // re-reads localStorage on every render.
  const stored = localStorage.getItem(STORAGE_KEY);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

function writeLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
  applyToDocument(lang);
  emit();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = useCallback((next: Language) => writeLanguage(next), []);

  const toggleLang = useCallback(
    () => writeLanguage(lang === "en" ? "km" : "en"),
    [lang]
  );

  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      // Falling back through English (rather than returning "") keeps a key
      // that somehow slipped past the compile-time check readable on screen.
      const table = translations[lang] ?? translations[DEFAULT_LANGUAGE];
      let text = table[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
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

/**
 * Blocking <head> script that stamps the saved language onto <html> before
 * first paint. Without it a Khmer user sees one frame of Latin-font English
 * while React hydrates. Kept to the attributes only (no text substitution) so
 * it can't disagree with what React renders.
 */
export function LanguageScript() {
  const js = `(function(){try{var l=localStorage.getItem('${STORAGE_KEY}');if(l!=='km'&&l!=='en')l='${DEFAULT_LANGUAGE}';document.documentElement.lang=l;document.documentElement.dataset.lang=l;}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
