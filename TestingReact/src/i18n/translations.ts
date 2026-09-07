/**
 * @file translations.ts
 * @description The English/Khmer dictionary for the whole UI.
 *
 * The Khmer side is not machine-translated: it is lifted from the legacy
 * Blazor app's `src/Apps/ServiceMaintenance/Resources/App.km-KH.resx`, which
 * is the terminology this business has actually been reading on screen for
 * years. Where a key has no .resx ancestor (screens the Blazor app never
 * had — spare-part stock in/out, the infinite-scroll footers, toasts) the
 * wording is built from that same vocabulary rather than invented, so
 * "គ្រឿងបន្លាស់"/"វិនិច្ឆ័យ"/"ម៉ាស៊ីន" keep meaning one thing across the app.
 *
 * Keys are namespaced (`nav.`, `status.`, `action.`, …) instead of reusing
 * the .resx names — those grew typos and inconsistent casing over time
 * (`Textsolution`, `TestThirdPartySelf`, a key literally named
 * "Item Recieved"), which is exactly the sort of thing a fresh dictionary
 * should not inherit.
 *
 * `km` is typed as Record<TranslationKey, string>, so dropping or misspelling
 * a key on either side is a compile error rather than a silent English
 * fallback in production.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FILE IS NOW A BARREL. The dictionaries live in `en.ts` and `km.ts`.
 *
 * Importing a VALUE from here pulls in BOTH languages, because `translations`
 * below needs both. That is correct for the server — `api/ai-search` reads the
 * whole dictionary to answer questions about the UI, and nothing it imports
 * reaches the browser — and wrong for any client component, which is why
 * `LanguageProvider` imports `./en` directly and fetches `./km` on demand.
 *
 * **Client components must not import a value from this module.** Types are
 * fine (`import type { TranslationKey }`) — they are erased at compile time.
 * For the language constants use `./languageConfig`, which carries no
 * dictionary at all.
 * ─────────────────────────────────────────────────────────────────────────
 */

import en, { type TranslationKey } from "./en";
import km from "./km";
import type { Language } from "./languageConfig";

export type { TranslationKey } from "./en";
export type { Language } from "./languageConfig";

/**
 * `translations` is the ONLY value this module exports, and that is deliberate.
 *
 * It briefly also re-exported `LANGUAGES`, `LANGUAGE_LABELS`, `LANGUAGE_SHORT`,
 * `en` and `km` "so existing imports keep working" — but every one of those
 * call sites had already been repointed at `./languageConfig`, so they had zero
 * consumers while still offering a one-import trapdoor: a single
 * `import { LANGUAGES } from "@/i18n/translations"` in a client component pulls
 * both dictionaries back into the shared chunk and silently undoes the split,
 * with nothing in lint or the build to catch it. Fewer exports here is the
 * guardrail.
 *
 * Server-side use only — see the note above. Today: `app/api/ai-search`.
 */
export const translations: Record<Language, Record<TranslationKey, string>> = { en, km };
