"use client";

/**
 * @file components/login/ShowcaseCurtain.tsx
 * @description The desktop (lg+) sliding accent curtain — the page's signature
 * move, now the PRISMATIC SHEAR: three chromatic blades in the triad hues
 * ride the sweep's leading edge, fanning up to ~28px apart through the fast
 * mid-section of the ease and reconverging into the resting light seam as
 * the panel settles — light passing through a prism, replayed on every
 * method switch. Blades animate small RELATIVE x offsets (they are children
 * of the already-translating panel — re-animating the panel's keyframes
 * would double-translate them). They also fan once on mount, deliberately:
 * it lands inside the entrance choreography alongside the card rim's load
 * flash (a ref-based first-mount guard would trip react-hooks/refs).
 *
 * Background is layered (deep base + accent gradient + rings + sheen) so the
 * panel has structure at every point instead of one flat colour field.
 * Perf hints (willChange/contain) are kept from v1 — the sweep is the single
 * biggest paint on this page.
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Bot,
  Package,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { useBrandLogo } from "@/services/brandLogoStore";
import BrandLogo from "@/components/BrandLogo";
import BrandChip from "./BrandChip";
import { AUTH_METHODS } from "./constants";
import { CURTAIN_EASE, DUR, REVEAL_EASE, SHEAR } from "./motion";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface ShowcaseCurtainProps {
  selectorOpen: boolean;
  mode: LoginMotionMode;
  holo: HoloTriad;
  onBack: () => void;
}

export default function ShowcaseCurtain({ selectorOpen, mode, holo, onBack }: ShowcaseCurtainProps) {
  const { lang, t } = useI18n();
  const { isDark, prefs } = useTheme();
  const brandLogo = useBrandLogo();
  const full = mode === "full";

  // Travel direction: opening the selector sweeps LEFT (blades trail right,
  // off the left edge); closing sweeps RIGHT (blades trail left, off the
  // right edge). Both fans point INTO the panel.
  const bladeDir = selectorOpen ? 1 : -1;
  const bladeColors = [`${holo.a}cc`, `${holo.b}99`, `${holo.c}66`];

  const slide = full
    ? { duration: DUR.curtain, ease: CURTAIN_EASE }
    : { duration: 0 };

  const contentTransition = full
    ? { duration: DUR.reveal, ease: REVEAL_EASE }
    : { duration: 0 };

  return (
    <motion.div
      initial={false}
      animate={{
        x: selectorOpen ? "-100%" : "0%",
        rotateY: full ? (selectorOpen ? [0, 3, 0] : [0, -3, 0]) : 0,
      }}
      transition={
        full
          ? { x: slide, rotateY: { ...slide, times: [0, 0.45, 1] } }
          : { duration: 0 }
      }
      style={{
        backgroundColor: isDark ? "#070d16" : "#091c2b",
        backgroundImage: isDark
          ? `linear-gradient(150deg, ${holo.a} 0%, ${holo.a}b3 32%, #0b1a2e 68%, #08101d 100%)`
          : `linear-gradient(155deg, ${holo.a}cc 0%, #0d2838 35%, #091a27 75%, #06131e 100%)`,
        willChange: "transform",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        contain: "paint layout",
      }}
      className="hidden lg:flex absolute top-0 left-1/2 w-1/2 h-full z-20 p-3.5 lg:p-4 xl:p-5 flex-col shadow-2xl border-x border-slate-200/50 dark:border-white/15 overflow-hidden"
    >
      {/* Structure: companion-hue glow orb, orbit rings, prismatic sheen */}
      <div
        className="absolute -top-16 -right-16 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: `${holo.b}1a` }}
      />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full border border-white/10 pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 rounded-full border border-white/[0.07] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: `linear-gradient(115deg, transparent 42%, rgba(255,255,255,0.07) 49%, ${holo.c}14 52%, transparent 58%)`,
        }}
      />

      {/* Prismatic shear blades — the signature. Three triad-hued hairlines
          stacked on the sweep's leading edge; per-flip they fan apart through
          the fast mid-ease and reconverge into the resting seam. */}
      <div
        className={`absolute inset-y-0 w-[2px] z-30 pointer-events-none ${selectorOpen ? "right-0" : "left-0"}`}
      >
        {bladeColors.map((color, i) => (
          <motion.div
            key={`${selectorOpen}-${i}`}
            initial={false}
            animate={
              full
                ? { x: [0, bladeDir * SHEAR.spreadPx[i], 0], opacity: [1, 0.9, 1] }
                : { x: 0, opacity: 1 }
            }
            transition={
              full
                ? {
                    duration: DUR.curtain,
                    ease: CURTAIN_EASE,
                    delay: SHEAR.delays[i],
                    times: [0, 0.45, 1],
                  }
                : { duration: 0 }
            }
            className="absolute inset-y-0 w-[2px]"
            style={{
              background: `linear-gradient(to bottom, transparent 4%, ${color} 30%, ${color} 70%, transparent 96%)`,
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {!selectorOpen ? (
          /* ── SIGN-IN MODE: Clean Brand Logo & System Functions ── */
          <motion.div
            key={`overlay-signin-${lang}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={contentTransition}
            className="relative z-10 flex flex-col justify-between h-full p-1 sm:p-2"
          >
            {/* Top header bar */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-[9px] xl:text-[10px] font-bold uppercase tracking-wider text-white/90 bg-white/15 px-3 py-1 rounded-full border border-white/20 shadow-xs inline-flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>{lang === "km" ? "ប្រព័ន្ធកម្រិតសហគ្រាស • Enterprise Portal" : "Enterprise Edition • v2.4"}</span>
              </span>

              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/30 shadow-xs shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${full ? "animate-pulse" : ""}`} />
                <span>Telemetry Live</span>
              </span>
            </div>

            {/* Central Brand Identity & Hero Logo */}
            <div className="flex flex-col items-center justify-center text-center my-auto py-2 space-y-3">
              {/* Prominent Logo Container with glowing aura */}
              <div className="relative group">
                <div
                  className="absolute -inset-2 rounded-3xl opacity-70 blur-xl transition-all duration-500 group-hover:opacity-100 pointer-events-none"
                  style={{ backgroundColor: `${holo.a}50` }}
                />
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/30 p-3 shadow-2xl flex items-center justify-center ring-4 ring-white/10">
                  {brandLogo ? (
                    <BrandLogo
                      src={brandLogo}
                      alt="Logo"
                      style={{ transform: `scale(${(prefs.logoScale ?? 130) / 100})` }}
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  ) : (
                    <ShieldCheck className="w-10 h-10 text-white" />
                  )}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg xl:text-xl font-black text-white tracking-tight leading-snug">
                  {lang === "km"
                    ? "ប្រព័ន្ធគ្រប់គ្រងការងារបច្ចេកទេស និងជួសជុល"
                    : "Technical & Repair Management System"}
                </h3>
                <p className="text-[11px] sm:text-xs font-semibold tracking-wide text-emerald-300/90 uppercase">
                  {t("login.brandTitle")}
                </p>
                <p className="text-[10.5px] sm:text-[11px] text-white/70 max-w-xs mx-auto leading-relaxed pt-0.5">
                  {lang === "km"
                    ? "ដំណោះស្រាយគ្រប់គ្រងការងារជួសជុល ស្តុកគ្រឿងបន្លាស់ និងតាមដានទិន្នន័យ Telemetry"
                    : "Unified solution for repair lifecycle, spare parts inventory & live telemetry"}
                </p>
              </div>

              {/* Core System Functions (Clean Minimalist 2x2 Grid) */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm pt-1">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-left transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">
                      {lang === "km" ? "សេវាកម្មជួសជុល" : "Repair Services"}
                    </p>
                    <p className="text-[9px] text-white/60 truncate">
                      {lang === "km" ? "តាមដានគ្រប់ដំណាក់កាល" : "End-to-end Tracking"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-left transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shrink-0">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">
                      {lang === "km" ? "ស្តុកគ្រឿងបន្លាស់" : "Spare Parts"}
                    </p>
                    <p className="text-[9px] text-white/60 truncate">
                      {lang === "km" ? "កាត់ស្តុក Real-Time" : "Real-time Stock"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-left transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 shrink-0">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">
                      {lang === "km" ? "ទិន្នន័យ Telemetry" : "Live Telemetry"}
                    </p>
                    <p className="text-[9px] text-white/60 truncate">
                      {lang === "km" ? "KPIs & របាយការណ៍" : "Real-time Insights"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/15 text-left transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">
                      {lang === "km" ? "ជំនួយការ AI" : "AI Intelligence"}
                    </p>
                    <p className="text-[9px] text-white/60 truncate">
                      {lang === "km" ? "ស្វែងរក និងវិភាគ" : "Smart Search & Assist"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom footnote */}
            <div className="flex items-center justify-between text-[10px] text-white/60 border-t border-white/15 pt-2 shrink-0">
              <span className="flex items-center gap-1 text-emerald-300/90 font-medium">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>{lang === "km" ? "សុវត្ថិភាពសហគ្រាស Zero-Trust" : "Zero-Trust Security"}</span>
              </span>
              <span className="flex items-center gap-1 text-cyan-300/80 font-mono text-[9.5px]">
                <Zap className="w-2.5 h-2.5 text-cyan-400" />
                <span>{lang === "km" ? "ភ្ជាប់បណ្តាញ Microservices" : "Real-Time Engine"}</span>
              </span>
            </div>
          </motion.div>
        ) : (
          /* ── SELECTOR MODE: multi-factor security brief ── */
          <motion.div
            key={`overlay-selector-${lang}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={contentTransition}
            className="relative z-10 flex flex-col h-full"
          >
            <div className="flex items-center gap-2 xl:gap-2.5 shrink-0">
              <BrandChip size="sm" fallback="shield" />
              <div>
                <span className="text-[8.5px] xl:text-[9.5px] font-bold uppercase tracking-wider text-white/90 bg-white/15 px-2.5 py-0.5 rounded-full border border-white/20 shadow-xs inline-block">
                  {lang === "km" ? "សុវត្ថិភាពសហគ្រាស" : "Enterprise Security"}
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white tracking-tight mt-0.5">
                  {lang === "km" ? "ការចូលប្រើប្រាស់ឆ្លាតវៃ" : "Multi-Factor Access"}
                </h3>
              </div>
            </div>

            <div className="my-auto space-y-3 xl:space-y-4">
              <div className="space-y-1">
                <h4 className="text-lg xl:text-xl font-black text-white tracking-tight leading-tight">
                  {lang === "km" ? "ជ្រើសរើសរបៀប Sign In ដែលអ្នកពេញចិត្ត" : "Flexible Sign-In Options"}
                </h4>
                <p className="text-[11px] sm:text-xs text-white/85 leading-snug">
                  {lang === "km"
                    ? "គាំទ្រទាំងពាក្យសម្ងាត់ស្តង់ដារ, CAM ID Mobile Face & Auth, និង Hardware Passkeys 1-Click។"
                    : "Seamlessly switch between Password, CAM ID Mobile Face & Auth, and FIDO2 Passkeys."}
                </p>
              </div>

              {/* Method preview strip */}
              <div className="grid grid-cols-3 gap-1.5">
                {AUTH_METHODS.map((method) => {
                  const MethodIcon = method.icon;
                  return (
                    <div
                      key={method.id}
                      className="rounded-xl border border-white/15 bg-white/[0.08] px-1.5 py-2 flex flex-col items-center gap-1 text-center"
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center border border-white/25"
                        style={{ backgroundColor: `${method.accentColor}38`, color: "#ffffff" }}
                      >
                        <MethodIcon className="w-3 h-3" />
                      </span>
                      <span className="text-[9px] font-bold text-white/85 tracking-wide">{method.tag}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2.5 text-xs text-white bg-white/[0.08] p-3 rounded-xl border border-white/15">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/40 shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-emerald-400">
                    {lang === "km" ? "សុវត្ថិភាពជីវមាត្រកម្រិតខ្ពស់ (Zero-Trust)" : "Enterprise Biometric Security"}
                  </div>
                  <div className="text-[10px] text-white/80 leading-relaxed">
                    {lang === "km"
                      ? "ចូលប្រើប្រាស់បានភ្លាមៗដោយមិនបាច់វាយពាក្យសម្ងាត់ ជាមួយ FIDO2, Face ID និង CAM ID Mobile App។"
                      : "Instant passwordless access with FIDO2, Apple Face ID, and CAM ID Mobile."}
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-4 xl:px-5 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs sm:text-[13px] hover:bg-white/90 hover:scale-[1.02] transition-[background-color,transform] duration-200 motion-reduce:transition-none shadow-xl shadow-black/25 cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{lang === "km" ? "ត្រឡប់ទៅផ្ទាំង Sign In" : "Back to Sign In"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
