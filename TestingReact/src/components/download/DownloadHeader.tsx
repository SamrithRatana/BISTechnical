"use client";

/**
 * @file components/download/DownloadHeader.tsx
 * @description Sticky header band: transparent over the hero, crossfading to a
 * solid underlay once scrolled. This is the ONLY element on the page allowed
 * `backdrop-blur` (it is never 3D-transformed); static mode keeps the solid
 * fill permanently.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ShieldCheck } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { LANGUAGES, LANGUAGE_SHORT } from "@/i18n/languageConfig";
import { DUR, REVEAL_EASE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

export default function DownloadHeader({ mode }: { mode: DownloadMotionMode }) {
  const { t, lang, setLang } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const full = mode === "full";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      initial={full ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
    >
      {/* Solid underlay, crossfaded by scroll position (opacity only) */}
      <div
        className={`absolute inset-0 border-b border-white/5 bg-[#06090e]/95 transition-opacity duration-200 ${
          full ? "backdrop-blur-md" : ""
        } ${scrolled ? "opacity-100" : "opacity-0"}`}
      />

      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand. Anchors rather than `router.push` on a button: this is a
            public page, so middle-click, ctrl-click and "copy link address"
            should all work — same reasoning as the /docs header. */}
        <Link href="/login" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/10">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </span>
          <span className="text-left">
            <span className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">CAM ID</span>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  {full && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  )}
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {t("download.badgeLive")}
              </span>
            </span>
            <span className="hidden text-[11px] text-slate-400 md:block">
              {t("download.brandTagline")}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* The manual. The two public pages point at each other: whoever came
              here for the app is often the same person who needs the guide, and
              /docs carries the mirror-image link back. */}
          <Link
            href="/docs"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-violet-400/50 hover:text-white"
            title={t("download.docsLink")}
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-300" />
            <span className="hidden lg:inline">{t("download.docsLink")}</span>
          </Link>

          {/* Back to sign-in */}
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline">{t("download.backToLogin")}</span>
          </Link>

          {/* Language segmented pill */}
          <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                className={`relative cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
                  lang === code ? "text-slate-950" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {lang === code && (
                  <motion.span
                    layoutId="dl-lang-pill"
                    className="absolute inset-0 rounded-lg bg-emerald-400"
                    transition={{ duration: DUR.panel }}
                  />
                )}
                <span className="relative">{LANGUAGE_SHORT[code]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
