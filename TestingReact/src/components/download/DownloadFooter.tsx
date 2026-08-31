"use client";

/**
 * @file components/download/DownloadFooter.tsx
 * @description Quiet footer: copyright, sign-in link, version. The page ends
 * still — nothing here animates beyond the shared reveal.
 */

import React from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";

export default function DownloadFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p>{t("download.footerCopyright")}</p>
        <div className="flex items-center gap-4">
          {/* Anchors: a footer link is navigation, so it should behave like
              one under middle-click and "copy link address". */}
          <Link href="/login" className="transition-colors hover:text-slate-300">
            {t("download.footerSignIn")}
          </Link>
          <span aria-hidden>•</span>
          {/* The two public pages link to each other: someone who came here for
              the app is often the same person who needs the manual. */}
          <Link href="/docs" className="transition-colors hover:text-slate-300">
            {t("download.docsLink")}
          </Link>
          <span aria-hidden>•</span>
          <span>{t("download.footerVersion")}</span>
        </div>
      </div>
    </footer>
  );
}
