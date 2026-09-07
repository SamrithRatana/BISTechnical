"use client";

/**
 * @file components/docs/LifecycleRail.tsx
 * @description The repair lifecycle drawn once, end to end: every status a
 * ticket can hold, the queue page that owns it, and what moves it on.
 *
 * This is the one diagram the whole manual leans on — a new technician who
 * reads nothing else should still leave knowing the chain. The rail scrolls
 * horizontally rather than wrapping, because a wrapped pipeline breaks its own
 * connector line and stops reading as a sequence.
 *
 * Motion: the connector "draws" by sliding a cover away (transform, never
 * width), and one pulse travels the line to show direction. Both drop in
 * static mode, leaving a legible printed-diagram version.
 *
 * The `status` strings are NOT translated. They are the literal values the app
 * shows in its own Status column and sends to the backend, so a reader
 * comparing this page against a real ticket has to see the same characters.
 */

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { accentSkin } from "./docsAccent";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { useAmbientMotion } from "./useAmbientMotion";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";
import { LIFECYCLE_COPY } from "./content/heroCopy";
import type { LifecycleStage } from "./docsTypes";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface LifecycleRailProps {
  stages: readonly LifecycleStage[];
  mode: DocsMotionMode;
  /** Jumps to the topic that documents this stage (`stage.topicId`). */
  onOpenTopic: (topicId: string) => void;
}

export default function LifecycleRail({ stages, mode, onOpenTopic }: LifecycleRailProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();
  const full = mode === "full";
  // The direction pulse is the page's only other forever-loop. It is UNMOUNTED
  // rather than paused when the rail is off screen: there is nothing to hold a
  // resting position for, and an element that does not exist cannot be driven.
  const railRef = useRef<HTMLElement>(null);
  const ambient = useAmbientMotion(railRef, mode);

  return (
    <section
      ref={railRef}
      id="lifecycle"
      className={`scroll-mt-24 border-y py-16 ${isDark ? "border-white/5" : "border-slate-200"}`}
    >
      <div className="mx-auto max-w-7xl 2xl:max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mb-10 max-w-3xl"
          initial={full ? { opacity: 0, y: 16 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_ONCE}
          transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
        >
          <p className={`mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${isDark ? "text-slate-500" : "text-slate-600"}`}>
            {text(LIFECYCLE_COPY.eyebrow)}
          </p>
          <h2
            className={`text-2xl font-black sm:text-3xl ${isDark ? "text-white" : "text-slate-900"} ${
              isKhmer ? "leading-snug" : "tracking-tight"
            }`}
          >
            {text(LIFECYCLE_COPY.title)}
          </h2>
          <p className={`mt-3 text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"} ${isKhmer ? "leading-loose" : ""}`}>
            {text(LIFECYCLE_COPY.body)}
          </p>
        </motion.div>

        {/* The rail. Wide content scrolls inside its own container — the page
            body must never scroll sideways. */}
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {/* `w-max` so the row sizes to its fixed-width cards and the
              connector spans all of them, `min-w-full` so a short chain still
              fills the section rather than huddling on the left. */}
          <div className="relative w-max min-w-full">
            {/* Connector line, drawn by a sliding cover */}
            <div aria-hidden className="absolute inset-x-6 top-[26px] h-[2px] overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: isDark
                    ? "linear-gradient(90deg, rgb(167 139 250 / 0.6), rgb(34 211 238 / 0.6) 45%, rgb(52 211 153 / 0.6))"
                    : "linear-gradient(90deg, rgb(124 58 237 / 0.85), rgb(8 145 178 / 0.85) 45%, rgb(5 150 105 / 0.85))",
                }}
              />
              {full && (
                <motion.div
                  className={`absolute inset-0 ${isDark ? "bg-[#05060f]" : "bg-slate-50"}`}
                  initial={{ x: "0%" }}
                  whileInView={{ x: "100%" }}
                  viewport={VIEWPORT_ONCE}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                />
              )}
              {ambient && (
                <motion.div
                  className="absolute top-0 h-full w-24"
                  style={{
                    background: isDark
                      ? "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.85), transparent)"
                      : "linear-gradient(90deg, transparent, rgb(15 23 42 / 0.55), transparent)",
                  }}
                  initial={{ x: "-100%" }}
                  animate={{ x: "1100%" }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 1.4,
                    delay: 0.9,
                  }}
                />
              )}
            </div>

            <ol className="relative flex items-stretch gap-3">
              {stages.map((stage, i) => {
                const skin = accentSkin(stage.accent, isDark);
                return (
                  <motion.li
                    key={stage.status}
                    className="flex w-[164px] shrink-0 flex-col"
                    initial={full ? { opacity: 0, y: 18 } : false}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={VIEWPORT_ONCE}
                    transition={{ duration: DUR.reveal, delay: i * 0.06, ease: REVEAL_EASE }}
                  >
                    {/* Node dot sits on the connector line, so it needs an
                        opaque fill. In dark that is the page colour painted
                        over `skin.chip`'s translucent tint; in light
                        `skin.chip` is already an opaque `-50` fill, so nothing
                        is added — a second `bg-*` here would only race the one
                        carrying the accent. */}
                    <div className="flex items-center gap-2 pl-1">
                      <motion.span
                        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border font-mono text-[10px] font-bold ${skin.chip} ${isDark ? "bg-[#05060f]" : ""}`}
                        initial={full ? { scale: 0 } : false}
                        whileInView={{ scale: 1 }}
                        viewport={VIEWPORT_ONCE}
                        transition={{ type: "spring", stiffness: 320, damping: 20, delay: i * 0.06 }}
                      >
                        {i + 1}
                      </motion.span>
                      {i < stages.length - 1 && (
                        <ArrowRight aria-hidden className={`h-3 w-3 shrink-0 ${isDark ? "text-slate-500" : "text-slate-700"}`} />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenTopic(stage.topicId)}
                      className={`mt-3 w-full flex-1 cursor-pointer rounded-2xl border p-3 text-left transition-all duration-150 hover:-translate-y-0.5 ${isDark ? `bg-[#080a14] ${skin.border}` : `bg-white ${skin.border} shadow-sm hover:shadow-md hover:border-violet-600`}`}
                    >
                      <span className={`block font-mono text-[10px] font-bold leading-tight ${isDark ? "text-slate-500" : "text-slate-600"}`}>

                        {stage.status}
                      </span>
                      <span className={`mt-1 block text-[13px] font-bold leading-snug ${isDark ? "text-white" : "text-slate-900"}`}>

                        {text(stage.label)}
                      </span>
                      <span className={`mt-1.5 block font-mono text-[10px] ${skin.text}`}>
                        {stage.route}
                      </span>
                      <span className={`mt-2 block text-[11px] leading-relaxed ${isDark ? "text-slate-500" : "text-slate-600"}`}>
                        {text(stage.note)}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </div>

        <p className={`mt-4 text-[11px] ${isDark ? "text-slate-500" : "text-slate-600"}`}>{text(LIFECYCLE_COPY.footnote)}</p>
      </div>
    </section>
  );
}
