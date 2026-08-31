"use client";

/**
 * @file components/docs/useDocsText.ts
 * @description Reads one side of a `Bilingual` value, following the app's own
 * language toggle.
 *
 * The Docs catalogue carries both languages inline rather than living in the
 * shared dictionary (see `docsTypes.ts` for why), so it cannot go through
 * `t("some.key")`. This hook is the bridge: the *mechanism* is still
 * `useI18n().lang`, so the header pill, the login screen and the manual all
 * switch together — only the payload is route-local.
 *
 * Khmer falls back to English when a string is empty, matching how `t()`
 * treats a missing key: a readable English sentence beats a blank line.
 */

import { useCallback } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { Bilingual } from "./docsTypes";

export type DocsTextReader = (value: Bilingual) => string;

export function useDocsText(): { text: DocsTextReader; isKhmer: boolean } {
  const { lang } = useI18n();
  const isKhmer = lang === "km";

  const text = useCallback(
    (value: Bilingual) => (isKhmer ? value.km || value.en : value.en),
    [isKhmer]
  );

  return { text, isKhmer };
}
