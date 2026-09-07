"use client";

/**
 * @file components/download/StatementDivider.tsx
 * @description Pure typographic breathing room between the hero and the
 * platform cards — one line, with the gradient hairline under the number
 * (sanctioned gradient appearance 2 of 4).
 */

import React from "react";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/LanguageProvider";
import { REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

export default function StatementDivider({ mode }: { mode: DownloadMotionMode }) {
  const { t } = useI18n();
  const full = mode === "full";
  const text = t("download.statementDivider");
  const [before, after] = text.split("59 ms");

  return (
    <motion.section
      className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6"
      initial={full ? { opacity: 0, y: 20 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: 0.4, ease: REVEAL_EASE }}
    >
      <p className="text-2xl font-semibold leading-relaxed text-slate-200 sm:text-3xl">
        {before}
        <span className="relative inline-block [font-variant-numeric:tabular-nums]">
          59 ms
          <span
            className="absolute inset-x-0 -bottom-1 h-[2px] rounded-full"
            style={{
              background: "linear-gradient(90deg, rgb(52 211 153), rgb(34 211 238))",
            }}
          />
        </span>
        {after}
      </p>
    </motion.section>
  );
}
