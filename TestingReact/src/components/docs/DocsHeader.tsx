"use client";

/**
 * @file components/docs/DocsHeader.tsx
 * @description Sticky header band: transparent over the hero, crossfading to a
 * solid underlay once scrolled, with the reading-progress hairline welded to
 * its bottom edge.
 *
 * This is the ONLY element on the page allowed `backdrop-blur` — it is never
 * 3D-transformed, unlike everything in the atlas subtree (see `AtlasCore.tsx`
 * for why a filter anywhere above a `preserve-3d` node flattens it in Safari).
 * Static mode keeps the solid fill permanently.
 *
 * The progress hairline animates `scaleX`, never `width`: a width animation
 * would lay out the header on every scroll frame.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, BookOpen, Smartphone } from "lucide-react";
import { LANGUAGES, LANGUAGE_SHORT } from "@/i18n/languageConfig";
import { useI18n } from "@/i18n/LanguageProvider";
import { DUR, REVEAL_EASE, SPY_SPRING } from "./motion";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface DocsHeaderProps {
  mode: DocsMotionMode;
  /** Rendered in the header's centre slot on desktop. */
  search: React.ReactNode;
}

export default function DocsHeader({ mode, search }: DocsHeaderProps) {
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
        className={`absolute inset-0 border-b border-white/5 bg-[#05060f]/95 transition-opacity duration-200 ${
          full ? "backdrop-blur-md" : ""
        } ${scrolled ? "opacity-100" : "opacity-0"}`}
      />

      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        {/* Brand. Real links, not `router.push` on a button: this is a public,
            indexable page, and middle-click, ctrl-click, "copy link" and
            crawlability all come free with an anchor. */}
        <Link href="/login" className="flex shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/10">
            <BookOpen className="h-5 w-5 text-violet-300" />
          </span>
          <span className="text-left">
            <span className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white">Docs</span>
              <span className="hidden rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-300 sm:inline">
                CAM ID
              </span>
            </span>
            <span className="hidden text-[11px] text-slate-400 md:block">
              {lang === "km"
                ? "ការណែនាំប្រើប្រាស់ប្រព័ន្ធ"
                : "Service & Maintenance Portal guide"}
            </span>
          </span>
        </Link>

        {/* Search — the centre slot on desktop, moved into the page on phones */}
        <div className="ml-auto hidden min-w-0 flex-1 justify-center lg:flex">{search}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0 sm:gap-3">
          <Link
            href="/download"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-white"
            title={lang === "km" ? "ទាញយកកម្មវិធីទូរស័ព្ទ" : "Get the mobile app"}
          >
            <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden xl:inline">{lang === "km" ? "កម្មវិធីទូរស័ព្ទ" : "Mobile app"}</span>
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-violet-400/50 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-violet-300" />
            <span className="hidden lg:inline">{lang === "km" ? "ត្រឡប់ទៅ Sign In" : "Back to Sign In"}</span>
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
                    layoutId="docs-lang-pill"
                    className="absolute inset-0 rounded-lg bg-violet-300"
                    transition={{ duration: DUR.panel }}
                  />
                )}
                <span className="relative">{LANGUAGE_SHORT[code]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reading progress — scaleX, never width */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[2px] origin-left"
        style={{
          scaleX: progress,
          background: "linear-gradient(90deg, rgb(167 139 250), rgb(34 211 238) 60%, rgb(52 211 153))",
        }}
      />
    </motion.header>
  );
}
