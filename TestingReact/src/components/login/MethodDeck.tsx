"use client";

/**
 * @file components/login/MethodDeck.tsx
 * @description The "Choose Sign-In Method" column: three method cards plus
 * the mobile-app download card. Cards enter with a staggered rotateX settle
 * under a local perspective (flat ancestors are fine — the projection is
 * local), and lift on hover. Selecting a method flips the curtain back.
 */

import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Layers, Smartphone } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { AuthMethod } from "./authMethodStore";
import { AUTH_METHODS } from "./constants";
import type { HoloTriad } from "./color";
import { DUR, LOAD, REVEAL_EASE } from "./motion";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface MethodDeckProps {
  authMethod: AuthMethod;
  mode: LoginMotionMode;
  holo: HoloTriad;
  onSelect: (method: AuthMethod) => void;
  onDownload: () => void;
  onBackMobile: () => void;
}

export default function MethodDeck({
  authMethod,
  mode,
  holo,
  onSelect,
  onDownload,
  onBackMobile,
}: MethodDeckProps) {
  const { lang } = useI18n();
  const full = mode === "full";

  const cardEntrance = (order: number) =>
    full
      ? {
          initial: { opacity: 0, y: 16, rotateX: -10 },
          animate: { opacity: 1, y: 0, rotateX: 0 },
          transition: { duration: DUR.card, delay: order * LOAD.deckStagger, ease: REVEAL_EASE },
        }
      : { initial: false as const, animate: { opacity: 1, y: 0, rotateX: 0 } };

  return (
    <motion.div
      key={`method-selector-view-${lang}`}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={full ? { duration: 0.28, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
      className="space-y-3 xl:space-y-3.5 max-w-[360px] xl:max-w-[380px] mx-auto w-full"
    >
      <div className="space-y-0.5">
        <div
          className="w-10 h-10 rounded-2xl border flex items-center justify-center shadow-xs mb-1"
          style={{ backgroundColor: `${holo.a}20`, borderColor: `${holo.a}40`, color: holo.a }}
        >
          <Layers className="w-5 h-5" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-300 tracking-tight leading-tight">
          {lang === "km" ? "ជ្រើសរើសរបៀប Sign In" : "Choose Sign-In Method"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
          {lang === "km"
            ? "ចុចលើប្រភេទផ្ទៀងផ្ទាត់អត្តសញ្ញាណដែលអ្នកចង់ប្រើប្រាស់"
            : "Click to select your preferred sign-in method"}
        </p>
      </div>

      <div className="space-y-2 pt-1 [perspective:900px]">
        {AUTH_METHODS.map((method, order) => {
          const MethodIcon = method.icon;
          const isCurrent = authMethod === method.id;
          const entrance = cardEntrance(order);

          return (
            <motion.button
              key={method.id}
              type="button"
              {...entrance}
              whileHover={full ? { y: -3, scale: 1.015 } : undefined}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(method.id)}
              className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between cursor-pointer group relative overflow-hidden transition-colors ${
                isCurrent
                  ? "bg-emerald-50/80 dark:bg-slate-900 border-emerald-500/90 shadow-md ring-1 ring-emerald-500/40 dark:ring-emerald-400/50"
                  : "bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/90 hover:border-slate-300 dark:bg-slate-950/70 dark:hover:bg-slate-900/90 dark:border-white/10 dark:hover:border-white/25 shadow-xs dark:shadow-md"
              }`}
              style={
                isCurrent
                  ? { boxShadow: `0 10px 30px -12px ${method.accentColor}40` }
                  : undefined
              }
            >
              {/* Active edge light — the card's triad, not a flat bar */}
              {isCurrent && (
                <span
                  className="pointer-events-none absolute left-0 inset-y-0 w-[3px]"
                  style={{ background: `linear-gradient(to bottom, ${holo.a}, ${holo.b})` }}
                />
              )}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/80 dark:border-white/20 shadow-md group-hover:scale-105 transition-transform motion-reduce:transition-none"
                  style={{ backgroundColor: `${method.accentColor}25`, color: method.accentColor }}
                >
                  <MethodIcon className="w-5 h-5" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors truncate">
                      {lang === "km" ? method.titleKm : method.titleEn}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-mono px-1.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/40 shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {lang === "km" ? method.descKm : method.descEn}
                  </p>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-slate-200/70 text-slate-600 dark:bg-white/5 dark:text-slate-400 group-hover:bg-emerald-500 group-hover:text-white dark:group-hover:text-slate-950 flex items-center justify-center transition-colors shrink-0 ml-2 shadow-xs">
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" />
              </div>
            </motion.button>
          );
        })}

        {/* CAM ID mobile-app download card */}
        <motion.button
          type="button"
          {...cardEntrance(AUTH_METHODS.length)}
          whileHover={full ? { y: -3, scale: 1.015 } : undefined}
          whileTap={{ scale: 0.98 }}
          onClick={onDownload}
          className="w-full p-2.5 sm:p-3 rounded-2xl bg-cyan-50/70 hover:bg-cyan-100/70 border border-cyan-200/90 hover:border-cyan-300 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 dark:border-cyan-500/30 dark:hover:border-cyan-400/60 text-left flex items-center justify-between cursor-pointer group shadow-xs dark:shadow-sm mt-2 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300 border border-cyan-500/30 dark:border-cyan-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform motion-reduce:transition-none">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors block truncate">
                {lang === "km" ? "ទាញយក CAM ID Mobile App" : "Download CAM ID Mobile App"}
              </span>
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                {lang === "km" ? "ដំឡើងលើ Android (.apk) ឬ iPhone (iOS)" : "Install on Android (.apk) or iPhone (iOS)"}
              </p>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white dark:group-hover:text-slate-950 flex items-center justify-center transition-colors shrink-0 ml-2">
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" />
          </div>
        </motion.button>
      </div>

      {/* Mobile back button (<lg) */}
      <div className="pt-2 text-center lg:hidden">
        <button
          type="button"
          onClick={onBackMobile}
          className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{lang === "km" ? "ត្រឡប់ទៅផ្ទាំង Login" : "Back to Sign In"}</span>
        </button>
      </div>
    </motion.div>
  );
}
