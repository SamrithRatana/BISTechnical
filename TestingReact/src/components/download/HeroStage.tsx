"use client";

/**
 * @file components/download/HeroStage.tsx
 * @description The hero: copy column + the 3D phone stage, lit by one static
 * key-light beam. Pointer tilt is tracked on the whole hero (not the phone),
 * so the rig answers the cursor from anywhere in the section.
 *
 * LCP guard: the H1 animates transform only (never opacity), so server HTML
 * paints visible headline text instead of waiting for hydration.
 */

import React from "react";
import { motion, type Variants } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { AndroidIcon, AppleIcon } from "./PlatformIcons";
import PhoneRig from "./PhoneRig";
import { useTiltRig } from "./useTiltRig";
import { DUR, HERO_TILT_RANGE, LOAD, REVEAL_EASE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";
import type { DownloadPlatform } from "./downloadConstants";

interface HeroStageProps {
  mode: DownloadMotionMode;
  onCta: (platform: DownloadPlatform) => void;
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

/** Renders the title with the brand name in the sanctioned gradient. */
function GradientTitle({ title }: { title: string }) {
  const [before, after] = title.split("CAM ID");
  return (
    <>
      {before}
      <span className="whitespace-nowrap bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
        CAM ID
      </span>
      {after}
    </>
  );
}

export default function HeroStage({ mode, onCta }: HeroStageProps) {
  const { t, lang } = useI18n();
  const full = mode === "full";
  const rig = useTiltRig(HERO_TILT_RANGE, 8, !full);
  const kmType = lang === "km" ? "tracking-normal leading-snug" : "tracking-tight";

  const stats: Array<{ value: string; label: string }> = [
    { value: "59ms", label: t("download.statLatencyLabel") },
    { value: "100%", label: t("download.statOnDeviceLabel") },
    { value: "0", label: t("download.statPasswordsLabel") },
  ];

  return (
    <section
      className="relative flex min-h-[92vh] w-full items-center"
      onPointerMove={rig.onPointerMove}
      onPointerLeave={rig.onPointerLeave}
    >
      {/* One static key-light beam replaces the old orb scatter */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-[-25%] h-[420px] w-[150vw] -rotate-[18deg]"
          style={{
            background:
              "linear-gradient(90deg, rgb(16 185 129 / 0.1), rgb(6 182 212 / 0.06) 55%, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-12 lg:gap-6">
        {/* Copy column */}
        <motion.div
          className="lg:col-span-7"
          variants={containerVariants}
          initial={full ? "hidden" : false}
          animate="visible"
        >
          <motion.div
            variants={itemVariants}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t("download.heroBadge")}</span>
          </motion.div>

          <motion.h1
            variants={titleVariants}
            className={`mb-5 text-4xl font-black text-white [text-wrap:balance] sm:text-6xl xl:text-7xl ${kmType}`}
          >
            <GradientTitle title={t("download.heroTitle")} />
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className={`mb-8 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-lg ${
              lang === "km" ? "leading-loose" : ""
            }`}
          >
            {t("download.heroSubtitle")}
          </motion.p>

          <motion.div variants={itemVariants} className="mb-10 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onCta("android")}
              className="flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-[0_0_40px_-10px_rgb(16_185_129/0.6)] transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <AndroidIcon className="w-5 h-5" />
              <span>{t("download.heroCtaAndroid")}</span>
            </button>
            <button
              type="button"
              onClick={() => onCta("ios")}
              className="flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-2xl border border-cyan-400/40 bg-transparent px-6 py-3 text-sm font-bold text-cyan-300 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <AppleIcon className="w-5 h-5" />
              <span>{t("download.heroCtaIos")}</span>
            </button>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"
          >
            {stats.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <span className="h-1 w-1 rounded-full bg-slate-700" aria-hidden />}
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                    {stat.value}
                  </span>
                  <span>{stat.label}</span>
                </span>
              </React.Fragment>
            ))}
          </motion.div>
        </motion.div>

        {/* The stage */}
        <div className="flex justify-center lg:col-span-5 lg:justify-end lg:pr-8">
          <div className="[perspective:1200px] [perspective-origin:60%_40%]">
            <PhoneRig mode={mode} rig={rig} />
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block"
        animate={full ? { y: [0, 6] } : undefined}
        transition={
          full ? { duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } : undefined
        }
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-500">
          <ChevronDown className="w-4 h-4" />
        </div>
      </motion.div>
    </section>
  );
}
