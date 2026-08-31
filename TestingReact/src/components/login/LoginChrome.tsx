"use client";

/**
 * @file components/login/LoginChrome.tsx
 * @description The page furniture around the stage: top bar (mobile-app pill,
 * the centred Docs pill and the language pill), the telemetry footer, and the
 * mobile (<lg) card header with its method-mode toggle.
 *
 * The top bar is a `1fr auto 1fr` grid, not `justify-between`: the two side
 * columns are equal by construction, so the Docs pill sits on the page's true
 * centre line however wide the CAM ID and language labels get. With three
 * children, `justify-between` would push it off-centre the moment those two
 * labels differ in width — which they do, in Khmer.
 */

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Globe, Layers, Smartphone } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import BrandChip from "./BrandChip";
import { useLoginMotionMode } from "./useLoginMotionMode";

/**
 * The two navigation pills are anchors, not buttons: both go somewhere, and an
 * anchor is what makes middle-click, ctrl-click and "copy link address" work —
 * on a sign-in screen the mobile-app and docs links are exactly the two things
 * someone wants to open in a second tab. Built once at module scope:
 * `motion.create` inside a render hands React a new component type every pass
 * and remounts the pill.
 */
const MotionLink = motion.create(Link);

// ─── Top bar ────────────────────────────────────────────────────────────────

export function LoginTopBar() {
  const { lang, toggleLang } = useI18n();
  const full = useLoginMotionMode() === "full";

  return (
    <div className="w-full max-w-md lg:max-w-3xl xl:max-w-[920px] 2xl:max-w-[980px] grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 z-20 shrink-0 px-1.5 sm:px-2">
      <MotionLink
        href="/download"
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        className="justify-self-start flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 hover:border-cyan-400 text-xs text-cyan-300 backdrop-blur-md shadow-lg shadow-black/40 transition-colors group"
        title="Download CAM ID Mobile App for Android & iOS"
      >
        <span className="relative flex">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 ${full ? "animate-ping" : ""}`} />
        </span>
        <span className="font-bold text-white text-[10.5px] sm:text-xs whitespace-nowrap">
          {/* The long label is what gives way while three pills share the
              narrow bar — the icon still carries the meaning. The breakpoint
              is `lg` because that is where the bar itself grows from
              max-w-md to max-w-3xl; expanding the labels any earlier makes
              them collide. */}
          <span className="hidden lg:inline">
            {lang === "km" ? "CAM ID App (Android / iOS)" : "Get CAM ID (Android / iOS)"}
          </span>
          <span className="lg:hidden">CAM ID</span>
        </span>
      </MotionLink>

      <DocsPill full={full} />

      <motion.button
        type="button"
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={toggleLang}
        className="justify-self-end flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-900/90 border border-white/15 hover:border-emerald-400/50 text-xs text-slate-200 backdrop-blur-md shadow-lg shadow-black/40 transition-colors cursor-pointer"
        title="Switch Language / ប្តូរភាសា"
      >
        <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-semibold text-[10.5px] sm:text-xs whitespace-nowrap">
          <span className="hidden lg:inline">
            {lang === "km" ? "🇰🇭 ភាសាខ្មែរ (KM)" : "🇬🇧 English (EN)"}
          </span>
          <span className="lg:hidden">{lang === "km" ? "ខ្មែរ" : "EN"}</span>
        </span>
      </motion.button>
    </div>
  );
}

/**
 * The centred Docs pill — the way into the public documentation hub.
 *
 * Its own component because it carries the only ambient loop in the top bar: a
 * sheen that travels across the pill on `transform` alone (never `left`, never
 * a `filter`), so the loop composites and costs nothing per frame. In static
 * mode the loop is dropped and the violet rim IS the design, not a fallback.
 */
function DocsPill({ full }: { full: boolean }) {
  return (
    <MotionLink
      href="/docs"
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.97 }}
      className="justify-self-center group relative flex items-center gap-1.5 overflow-hidden rounded-full border border-violet-400/40 bg-slate-900/90 px-3 py-1 text-xs text-violet-200 shadow-lg shadow-black/40 backdrop-blur-md transition-colors hover:border-violet-300 sm:gap-2 sm:px-4 sm:py-1.5"
      title="System documentation — ឯកសារណែនាំប្រើប្រាស់ប្រព័ន្ធ"
      aria-label="Open the system documentation"
    >
      {/* Travelling sheen — transform only */}
      {full && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-14 skew-x-[-18deg]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(196 181 253 / 0.22), transparent)",
          }}
          animate={{ x: ["-140%", "460%"] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.6 }}
        />
      )}

      <span className="relative flex">
        <BookOpen className="w-3.5 h-3.5 text-violet-300 transition-transform group-hover:scale-110" />
        <span
          className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-violet-300 ${
            full ? "animate-pulse" : ""
          }`}
        />
      </span>
      <span className="relative text-[10.5px] font-bold tracking-wide text-white sm:text-xs">
        Docs
      </span>
      <span className="relative hidden whitespace-nowrap text-[10px] font-medium text-violet-300/80 lg:inline">
        ឯកសារណែនាំ
      </span>
    </MotionLink>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

export function LoginFooter() {
  const { lang } = useI18n();
  const full = useLoginMotionMode() === "full";

  return (
    <div className="mt-1 xl:mt-2 mb-0.5 z-20 flex items-center gap-2 px-3 py-0.5 sm:py-1 rounded-full bg-slate-900/80 border border-white/10 text-[9.5px] sm:text-[10.5px] text-slate-400 font-mono shadow-lg shadow-black/40 backdrop-blur-md select-none shrink-0">
      <span className="text-slate-300 font-semibold">v2.4 Enterprise</span>
      <span className="text-slate-600">•</span>
      <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
        <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] ${full ? "animate-pulse" : ""}`} />
        <span>{lang === "km" ? "ប្រព័ន្ធ Microservices ទាំងអស់ដំណើរការធម្មតា" : "All Microservices Operational"}</span>
      </span>
    </div>
  );
}

// ─── Mobile card header (<lg) ───────────────────────────────────────────────

interface MobileMethodHeaderProps {
  selectorOpen: boolean;
  onToggle: () => void;
}

export function MobileMethodHeader({ selectorOpen, onToggle }: MobileMethodHeaderProps) {
  const { lang, t } = useI18n();

  return (
    <div className="lg:hidden p-3 sm:p-3.5 border-b border-white/10 flex items-center justify-between bg-slate-950/80 sticky top-0 z-20 backdrop-blur-md">
      <div className="flex items-center gap-2 sm:gap-2.5">
        <BrandChip size="sm" />
        <span className="font-bold text-xs sm:text-sm tracking-tight text-white block">
          {t("login.brandTitle")}
        </span>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors cursor-pointer"
      >
        <Layers className="w-3.5 h-3.5" />
        <span>
          {selectorOpen
            ? lang === "km"
              ? "ត្រឡប់ក្រោយ"
              : "Back"
            : lang === "km"
              ? "ប្តូររបៀប Sign In"
              : "Switch Method"}
        </span>
      </button>
    </div>
  );
}
