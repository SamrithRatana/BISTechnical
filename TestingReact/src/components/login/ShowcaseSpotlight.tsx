"use client";

/**
 * @file components/login/ShowcaseSpotlight.tsx
 * @description The curtain's feature showcase: one large glass spotlight card
 * that turns in with a shallow 3D entrance, driven by a four-tab dock beneath
 * it. Replaces the earlier cover-flow — wing cards clipped at the curtain
 * edges read as a defect, not depth, inside a half-width panel.
 *
 * The active tab carries a scaleX progress bar synced to the auto-advance
 * timer (hidden while hovered, since hovering pauses the timer). Glass
 * surfaces are translucent white WITHOUT backdrop-blur — this subtree lives
 * under a 3D transform, and the curtain gradient behind is smooth enough that
 * blur would add cost and nothing else.
 */

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Zap } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { SHOWCASE_CARDS } from "./constants";
import { DUR, REVEAL_EASE } from "./motion";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface ShowcaseSpotlightProps {
  mode: LoginMotionMode;
}

function cardAccentText(color: string) {
  if (color === "#10b981") return "#6ee7b7";
  if (color === "#06b6d4") return "#67e8f9";
  if (color === "#14b8a6") return "#5eead4";
  return "#7dd3fc";
}

export default function ShowcaseSpotlight({ mode }: ShowcaseSpotlightProps) {
  const { lang } = useI18n();
  const full = mode === "full";
  const [activeIdx, setActiveIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-advance timer (cycles every 4.5s unless hovered)
  useEffect(() => {
    if (isHovered) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % SHOWCASE_CARDS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isHovered]);

  const activeCard = SHOWCASE_CARDS[activeIdx] ?? SHOWCASE_CARDS[0];
  const ActiveIcon = activeCard.icon;

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 py-0.5">
      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0 px-1 pt-0.5">
        <span className="text-[9.5px] sm:text-[10px] font-semibold tracking-wider text-white/60 uppercase">
          {lang === "km" ? "មុខងារស្នូល" : "Core Features"}
        </span>
        <span className="text-[8.5px] font-mono text-white/40 bg-white/[0.06] px-2 py-0.5 rounded-full border border-white/10">
          4 Modules
        </span>
      </div>

      {/* 4 Cards in 1 Single Horizontal Row - Positioned Up */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2 xl:gap-2.5 mt-0.5">
        {SHOWCASE_CARDS.map((card, idx) => {
          const CardIcon = card.icon;
          const isActive = activeIdx === idx;
          return (
            <button
              type="button"
              key={card.id}
              onClick={() => setActiveIdx(idx)}
              onMouseEnter={() => {
                setActiveIdx(idx);
                setIsHovered(true);
              }}
              onMouseLeave={() => setIsHovered(false)}
              className={`group relative rounded-2xl border p-2 sm:p-2.5 flex flex-col items-center justify-between text-center transition-all duration-300 cursor-pointer min-h-[82px] sm:min-h-[86px] ${
                isActive
                  ? "bg-white/[0.10] scale-[1.02] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
                  : "border-white/[0.08] bg-white/[0.035] hover:bg-white/[0.07] hover:border-white/20 opacity-70 hover:opacity-100"
              }`}
              style={
                isActive
                  ? {
                      borderColor: `${card.accentColor}70`,
                      boxShadow: `0 0 20px ${card.accentColor}20, inset 0 1px 0 rgba(255,255,255,0.2)`,
                    }
                  : undefined
              }
            >
              {/* Top Accent Line on Active */}
              {isActive && (
                <div
                  className="absolute top-0 inset-x-3 h-0.5 rounded-full"
                  style={{ backgroundColor: card.accentColor }}
                />
              )}

              {/* Accent Icon Badge */}
              <div
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-2xs relative overflow-hidden transition-transform group-hover:scale-110 motion-reduce:transition-none"
                style={{
                  backgroundColor: `${card.accentColor}22`,
                  color: card.accentColor,
                }}
              >
                <CardIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>

              {/* Title */}
              <h4 className="text-[10px] sm:text-[10.5px] font-semibold text-white tracking-tight truncate w-full my-0.5">
                {lang === "km" ? card.titleKm : card.titleEn}
              </h4>

              {/* Tag */}
              <span
                className="text-[7.5px] sm:text-[8px] font-mono px-1.5 py-0.5 rounded-full border font-medium tracking-tight whitespace-nowrap"
                style={{
                  backgroundColor: `${card.accentColor}14`,
                  borderColor: `${card.accentColor}30`,
                  color:
                    card.accentColor === "#10b981"
                      ? "#6ee7b7"
                      : card.accentColor === "#06b6d4"
                      ? "#67e8f9"
                      : card.accentColor === "#14b8a6"
                      ? "#5eead4"
                      : "#7dd3fc",
                }}
              >
                {card.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Feature Showcase Spotlight Card - Modern Soft Glass */}
      <div
        className="flex-1 min-h-[110px] sm:min-h-[120px] flex flex-col justify-between rounded-2xl border border-white/[0.09] p-3 sm:p-3.5 relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-xs my-1"
        style={{
          background: `radial-gradient(circle at 88% 18%, ${activeCard.accentColor}18 0%, transparent 65%), radial-gradient(circle at 12% 82%, ${activeCard.accentColor}0a 0%, transparent 55%), rgba(255,255,255,0.035)`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Specular top rim light */}
        <div className="pointer-events-none absolute top-0 inset-x-4 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeCard.id}
            initial={full ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={full ? { opacity: 0, y: -8 } : undefined}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex-1 flex flex-col justify-between gap-2 min-h-0"
          >
            {/* Header: Icon + Title + Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-xs"
                  style={{
                    backgroundColor: `${activeCard.accentColor}25`,
                    color: activeCard.accentColor,
                  }}
                >
                  <ActiveIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-[12.5px] font-semibold text-white tracking-tight truncate">
                    {lang === "km" ? activeCard.titleKm : activeCard.titleEn}
                  </h3>
                  <p className="text-[9px] text-white/50 font-mono truncate">
                    {lang === "km" ? activeCard.badgeKm : activeCard.badgeEn}
                  </p>
                </div>
              </div>

              <span
                className="text-[8.5px] font-mono px-2 py-0.5 rounded-full border font-medium shrink-0"
                style={{
                  backgroundColor: `${activeCard.accentColor}18`,
                  borderColor: `${activeCard.accentColor}35`,
                  color:
                    cardAccentText(activeCard.accentColor),
                }}
              >
                {activeCard.tag}
              </span>
            </div>

            {/* Description */}
            <p className="text-[10.5px] sm:text-[11px] text-white/80 leading-relaxed line-clamp-2">
              {lang === "km" ? activeCard.descKm : activeCard.descEn}
            </p>

            {/* Soft Feature Highlights Pills */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {activeCard.id === "gemini" && (
                <>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    <span>OCR Serial Scan</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" />
                    <span>Smart Diagnostics</span>
                  </span>
                </>
              )}
              {activeCard.id === "biometrics" && (
                <>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-cyan-300 bg-cyan-950/30 border border-cyan-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    <span>Face Recognition</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-cyan-300 bg-cyan-950/30 border border-cyan-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-cyan-400" />
                    <span>FIDO2 Passkeys</span>
                  </span>
                </>
              )}
              {activeCard.id === "telemetry" && (
                <>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-teal-300 bg-teal-950/30 border border-teal-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-teal-400" />
                    <span>Live 120 FPS</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-teal-300 bg-teal-950/30 border border-teal-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-teal-400" />
                    <span>SignalR Sync</span>
                  </span>
                </>
              )}
              {activeCard.id === "spareparts" && (
                <>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-sky-300 bg-sky-950/30 border border-sky-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-sky-400" />
                    <span>Auto-Reconciliation</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-sky-300 bg-sky-950/30 border border-sky-500/25 px-2 py-0.5 rounded-full">
                    <span className="w-1 h-1 rounded-full bg-sky-400" />
                    <span>Serial Matrix</span>
                  </span>
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Auto-advance hairline progress */}
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-white/10 overflow-hidden">
          <motion.div
            key={activeIdx}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{
              duration: isHovered ? 0 : 4.5,
              ease: "linear",
            }}
            className="h-full origin-left"
            style={{ backgroundColor: activeCard.accentColor }}
          />
        </div>
      </div>

      {/* Bottom Trust & Architecture Bar */}
      <div className="shrink-0 pt-1 border-t border-white/10 flex items-center justify-between text-[8.5px] sm:text-[9px] text-white/50 px-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>{lang === "km" ? "សុវត្ថិភាពសហគ្រាស Zero-Trust" : "Zero-Trust Architecture"}</span>
        </div>
        <div className="flex items-center gap-1 text-white/40 font-mono">
          <Zap className="w-2.5 h-2.5 text-cyan-400" />
          <span>Real-Time Engine</span>
        </div>
      </div>
    </div>
  );
}
