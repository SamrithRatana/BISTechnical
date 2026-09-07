"use client";

/**
 * @file components/download/ClosingCta.tsx
 * @description Short closing section: one headline, the two platform CTAs
 * repeated, over a faint mirrored echo of the hero's key-light beam.
 */

import React from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/LanguageProvider";
import { AndroidIcon, AppleIcon } from "./PlatformIcons";
import { REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";
import type { DownloadPlatform } from "./downloadConstants";

interface ClosingCtaProps {
  mode: DownloadMotionMode;
  onCta: (platform: DownloadPlatform) => void;
}

export default function ClosingCta({ mode, onCta }: ClosingCtaProps) {
  const { t } = useI18n();
  const full = mode === "full";

  return (
    <section className="relative overflow-hidden py-24">
      {/* Mirrored echo of the key-light beam */}
      <div
        className="pointer-events-none absolute -bottom-24 left-[-25%] h-[300px] w-[150vw] rotate-[18deg]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgb(6 182 212 / 0.05) 45%, rgb(16 185 129 / 0.08))",
        }}
      />

      <motion.div
        className="relative mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 text-center sm:px-6"
        initial={full ? { opacity: 0, y: 24 } : false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: 0.4, ease: REVEAL_EASE }}
      >
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          {t("download.closingTitle")}
        </h2>

        <div className="flex flex-wrap items-center justify-center gap-3">
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
            className="flex min-h-[52px] cursor-pointer items-center gap-2.5 rounded-2xl border border-cyan-400/40 px-6 py-3 text-sm font-bold text-cyan-300 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <AppleIcon className="w-5 h-5" />
            <span>{t("download.heroCtaIos")}</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-600">{t("download.securityFootnote")}</p>
      </motion.div>
    </section>
  );
}
