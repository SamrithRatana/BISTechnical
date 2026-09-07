"use client";

/**
 * @file components/docs/DocsHeader.tsx
 * @description Sticky header band: transparent over the hero, crossfading to a
 * solid underlay once scrolled, with theme toggle and reading progress.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, BookOpen, Moon, Smartphone, Sun } from "lucide-react";
import { LANGUAGES, LANGUAGE_SHORT } from "@/i18n/languageConfig";
import { useI18n } from "@/i18n/LanguageProvider";
import { DUR, REVEAL_EASE, SPY_SPRING } from "./motion";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface DocsHeaderProps {
  mode: DocsMotionMode;
  /** Rendered in the header's centre slot on desktop. */
  search: React.ReactNode;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export default function DocsHeader({ mode, search, isDark = true, onToggleTheme }: DocsHeaderProps) {
  const { lang, setLang } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const full = mode === "full";

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, SPY_SPRING);

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
        className={`absolute inset-0 border-b transition-opacity duration-200 ${
          isDark
            ? "border-white/5 bg-[#05060f]/95"
            : "border-slate-200/80 bg-white/95 shadow-sm"
        } ${full ? "backdrop-blur-md" : ""} ${scrolled ? "opacity-100" : "opacity-0"}`}
      />

      <div className="relative mx-auto flex h-16 max-w-7xl 2xl:max-w-[1536px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/login" className="flex shrink-0 items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              isDark ? "border-violet-400/40 bg-violet-500/10" : "border-violet-400 bg-violet-100"
            }`}
          >
            <BookOpen className={`h-5 w-5 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
          </span>
          <span className="text-left">
            <span className="flex items-center gap-2">
              <span className={`text-base font-extrabold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>Docs</span>
              <span
                className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline ${
                  isDark
                    ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
                    : "border-violet-300 bg-violet-100 text-violet-700"
                }`}
              >
                CAM ID
              </span>
            </span>
            <span className={`hidden text-[11px] md:block ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {lang === "km"
                ? "ការណែនាំប្រើប្រាស់ប្រព័ន្ធ"
                : "Service & Maintenance Portal guide"}
            </span>
          </span>
        </Link>

        {/* Search — the centre slot on desktop */}
        <div className="ml-auto hidden min-w-0 flex-1 justify-center lg:flex">{search}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 sm:gap-2.5">
          <Link
            href="/download"
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              isDark
                ? "border-white/10 text-slate-300 hover:border-cyan-400/50 hover:text-white"
                : "border-slate-200 text-slate-700 hover:border-cyan-500 hover:text-slate-950 bg-white/80 shadow-sm"
            }`}
            title={lang === "km" ? "ទាញយកកម្មវិធីទូរស័ព្ទ" : "Get the mobile app"}
          >
            <Smartphone className={`h-3.5 w-3.5 ${isDark ? "text-cyan-400" : "text-cyan-700"}`} />
            <span className="hidden xl:inline">{lang === "km" ? "កម្មវិធីទូរស័ព្ទ" : "Mobile app"}</span>
          </Link>

          <Link
            href="/login"
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              isDark
                ? "border-white/10 text-slate-300 hover:border-violet-400/50 hover:text-white"
                : "border-slate-200 text-slate-700 hover:border-violet-500 hover:text-slate-950 bg-white/80 shadow-sm"
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {lang === "km" ? "ត្រឡប់ទៅ Sign In" : "Back to Sign In"}
            </span>
          </Link>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? (lang === "km" ? "ប្តូរទៅ Light Mode" : "Switch to Light Mode") : (lang === "km" ? "ប្តូរទៅ Dark Mode" : "Switch to Dark Mode")}
            aria-label="Toggle Theme"
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              isDark
                ? "border-white/10 bg-white/[0.04] text-amber-300 hover:bg-white/10 hover:text-amber-200"
                : "border-slate-200 bg-white text-violet-700 shadow-sm hover:bg-slate-100 hover:text-violet-900"
            }`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Language toggle */}
          <div className={`flex items-center rounded-xl border p-0.5 ${
            isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-slate-100"
          }`}>
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition-colors ${
                  lang === l
                    ? isDark
                      ? "bg-violet-500/30 text-violet-200"
                      : "bg-violet-600 text-white shadow-sm"
                    : isDark
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {LANGUAGE_SHORT[l]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress hairline welded to header's bottom edge */}
      <motion.div
        className={`h-[2px] w-full origin-left bg-gradient-to-r ${
          isDark
            ? "from-violet-400 via-cyan-400 to-emerald-400"
            : "from-violet-600 via-cyan-600 to-emerald-600"
        }`}
        style={{ scaleX: progress }}
      />
    </motion.header>
  );
}
