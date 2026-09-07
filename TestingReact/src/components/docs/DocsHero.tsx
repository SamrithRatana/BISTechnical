"use client";

/**
 * @file components/docs/DocsHero.tsx
 * @description The hero: copy column + the Atlas stage, lit by one static
 * key-light wedge. Pointer tilt is tracked on the whole hero (not the atlas),
 * so the rig answers the cursor from anywhere in the section.
 *
 * LCP guard, same as `download/HeroStage.tsx`: the H1 animates transform only
 * — never opacity — so the server HTML paints visible headline text instead of
 * waiting for hydration to reveal it.
 */

import React, { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { ChevronDown, Compass, Sparkles } from "lucide-react";
import AtlasCore from "./AtlasCore";
import { useAmbientMotion } from "./useAmbientMotion";
import { useDocsTilt } from "./useDocsTilt";
import { ATLAS_TILT_RANGE, DUR, LOAD, REVEAL_EASE } from "./motion";
import { useDocsText } from "./useDocsText";
import { useDocsTheme } from "./DocsThemeContext";
import { HERO_COPY } from "./content/heroCopy";
import type { DocsMotionMode } from "./useDocsMotionMode";

interface DocsHeroProps {
  mode: DocsMotionMode;
  /** Scrolls to the first chapter. */
  onStart: () => void;
  /** Scrolls to the lifecycle rail. */
  onLifecycle: () => void;
  stats: Array<{ value: string; label: string }>;
}

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: LOAD.heroStagger, delayChildren: LOAD.heroDelay },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.reveal, ease: REVEAL_EASE } },
};

/** H1 only: transform, never opacity — see the LCP note above. */
const titleVariants: Variants = {
  hidden: { y: 16 },
  visible: { y: 0, transition: { duration: DUR.reveal, ease: REVEAL_EASE } },
};

/** Renders the title with the highlighted phrase in the sanctioned gradient. */
function GradientTitle({
  title,
  accentPhrase,
  isDark,
}: {
  title: string;
  accentPhrase: string;
  isDark: boolean;
}) {
  const [before, after] = title.split(accentPhrase);
  if (after === undefined) return <>{title}</>;
  return (
    <>
      {before}
      <span
        className={`bg-gradient-to-r bg-clip-text text-transparent ${
          isDark
            ? "from-violet-300 via-cyan-300 to-emerald-300"
            : "from-violet-700 via-cyan-700 to-emerald-700"
        }`}
      >
        {accentPhrase}
      </span>
      {after}
    </>
  );
}

export default function DocsHero({ mode, onStart, onLifecycle, stats }: DocsHeroProps) {
  const { text, isKhmer } = useDocsText();
  const { isDark } = useDocsTheme();
  const full = mode === "full";
  const rig = useDocsTilt(ATLAS_TILT_RANGE, 9, !full);
  // The hero's forever-loops stop once the reader has scrolled past it, and
  // while the tab is in the background. The one-shot entrance still plays on
  // `full` — it is over before any of this can matter.
  const heroRef = useRef<HTMLElement>(null);
  const ambient = useAmbientMotion(heroRef, mode);
  const kmType = isKhmer ? "tracking-normal leading-snug" : "tracking-tight";

  return (
    <section
      ref={heroRef}
      className="relative flex min-h-[94vh] w-full items-center"
      onPointerMove={rig.onPointerMove}
      onPointerLeave={rig.onPointerLeave}
    >
      {/* One static key-light wedge behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-[-25%] h-[460px] w-[150vw] -rotate-[16deg]"
          style={{
            background: isDark
              ? "linear-gradient(90deg, rgb(139 92 246 / 0.12), rgb(6 182 212 / 0.06) 55%, transparent)"
              : "linear-gradient(90deg, rgb(139 92 246 / 0.07), rgb(6 182 212 / 0.04) 55%, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl 2xl:max-w-[1536px] grid-cols-1 items-center gap-12 px-4 pb-20 pt-28 sm:px-6 lg:px-8 lg:grid-cols-12 lg:gap-8">
        {/* Copy column */}
        <motion.div
          className="lg:col-span-7"
          variants={containerVariants}
          initial={full ? "hidden" : false}
          animate="visible"
        >
          <motion.div
            variants={itemVariants}
            className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${isDark ? "border-violet-500/25 bg-violet-500/10 text-violet-200" : "border-violet-300 bg-violet-100 text-violet-800 shadow-sm"}`}
          >
            <Sparkles className={`h-3.5 w-3.5 ${isDark ? "text-violet-300" : "text-violet-600"}`} />
            <span>{text(HERO_COPY.badge)}</span>
          </motion.div>

          <motion.h1
            variants={titleVariants}
            className={`mb-5 text-4xl font-black [text-wrap:balance] sm:text-6xl xl:text-7xl ${isDark ? "text-white" : "text-slate-900"} ${kmType}`}
          >
            <GradientTitle
              title={text(HERO_COPY.title)}
              accentPhrase={text(HERO_COPY.titleAccent)}
              isDark={isDark}
            />
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className={`mb-8 max-w-xl text-sm leading-relaxed sm:text-lg ${isDark ? "text-slate-400" : "text-slate-600"} ${
              isKhmer ? "leading-loose" : ""
            }`}
          >
            {text(HERO_COPY.subtitle)}
          </motion.p>

          <motion.div variants={itemVariants} className="mb-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onStart}
              className={`flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-bold transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                isDark
                  ? "bg-violet-400 text-slate-950 shadow-[0_0_40px_-10px_rgb(139_92_246/0.7)]"
                  : "bg-violet-600 text-white shadow-[0_10px_30px_-12px_rgb(109_40_217/0.55)]"
              }`}
            >
              <Compass className="h-5 w-5" />
              <span>{text(HERO_COPY.ctaStart)}</span>
            </button>
            <button
              type="button"
              onClick={onLifecycle}
              className={`flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-2xl border px-6 py-3 text-sm font-bold transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98] ${
                isDark
                  ? "border-cyan-400/40 text-cyan-300"
                  : "border-cyan-600 bg-white/70 text-cyan-700 shadow-sm"
              }`}
            >
              <span>{text(HERO_COPY.ctaLifecycle)}</span>
            </button>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={itemVariants}
            className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${
              isDark ? "text-slate-500" : "text-slate-600"
            }`}
          >
            {stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className={`h-1 w-1 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-400"}`}
                  />
                )}
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-sm font-semibold [font-variant-numeric:tabular-nums] ${
                      isDark ? "text-slate-200" : "text-slate-900"
                    }`}
                  >
                    {stat.value}
                  </span>
                  <span>{stat.label}</span>
                </span>
              </React.Fragment>
            ))}
          </motion.div>
        </motion.div>

        {/* The stage */}
        <div className="flex justify-center lg:col-span-5 lg:justify-end lg:pr-6">
          <div className="[perspective:1400px] [perspective-origin:58%_42%]">
            <AtlasCore mode={mode} rig={rig} ambient={ambient} />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block"
        animate={ambient ? { y: [0, 6] } : { y: 0 }}
        transition={
          ambient
            ? { duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
            : { duration: DUR.reveal }
        }
      >
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border ${
            isDark ? "border-white/10 text-slate-500" : "border-slate-300 text-slate-600"
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </div>
      </motion.div>
    </section>
  );
}
