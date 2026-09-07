"use client";

/**
 * @file components/download/InstallStep.tsx
 * @description One step on the mobile install timeline: numbered node on the
 * rail, title/body card, and a full-width action. Tapping the action stamps
 * the node with an accent check (soft visual progress, nothing persisted).
 */

import React from "react";
import { motion } from "framer-motion";
import { Check, ExternalLink } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";
import type { DownloadPlatform } from "./downloadConstants";

export interface InstallStepAction {
  label: string;
  onClick: () => void;
  /** When set, the CTA is an external link (opens a store page). */
  href?: string;
  icon: React.ReactNode;
}

interface InstallStepProps {
  index: number;
  stepLabelKey: TranslationKey;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  action: InstallStepAction;
  platform: DownloadPlatform;
  done: boolean;
  current: boolean;
  mode: DownloadMotionMode;
}

const ACCENT = {
  android: {
    node: "border-emerald-400 bg-emerald-500 text-slate-950",
    ring: "bg-emerald-400/40",
    label: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    button: "bg-emerald-500 text-slate-950",
  },
  ios: {
    node: "border-cyan-400 bg-cyan-500 text-slate-950",
    ring: "bg-cyan-400/40",
    label: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    button: "bg-cyan-500 text-slate-950",
  },
} as const;

export default function InstallStep({
  index,
  stepLabelKey,
  titleKey,
  bodyKey,
  action,
  platform,
  done,
  current,
  mode,
}: InstallStepProps) {
  const { t } = useI18n();
  const a = ACCENT[platform];
  const full = mode === "full";

  const ctaClass = `flex w-full min-h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-transform duration-150 active:scale-[0.98] ${
    current || done ? a.button : "border border-white/10 bg-white/[0.04] text-slate-200"
  }`;

  return (
    <motion.div
      className="flex gap-4"
      initial={full ? { opacity: 0, x: -16 } : false}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={VIEWPORT_ONCE}
      transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
    >
      {/* Node on the rail */}
      <div className="relative z-10 mt-3 h-8 w-8 shrink-0">
        {current && !done && full && (
          <motion.span
            className={`absolute inset-0 rounded-full ${a.ring}`}
            animate={{ scale: [1, 1.35], opacity: [0.7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <motion.span
          className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${
            done ? a.node : "border-white/15 bg-[#0a0f16] text-slate-300"
          }`}
          style={{ transformOrigin: "center" }}
          initial={false}
          animate={{ rotateX: done ? [90, 0] : 0 }}
          transition={{ duration: 0.3 }}
        >
          {done ? <Check className="w-4 h-4" /> : index}
        </motion.span>
      </div>

      {/* Card */}
      <div className="min-w-0 flex-1 space-y-2 rounded-2xl border border-white/10 bg-[#0a0f16] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-white">{t(titleKey)}</span>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${a.label}`}>
            {t(stepLabelKey)}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-400">{t(bodyKey)}</p>
        {action.href ? (
          <a
            href={action.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={action.onClick}
            className={ctaClass}
          >
            {action.icon}
            <span>{action.label}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        ) : (
          <button type="button" onClick={action.onClick} className={ctaClass}>
            {action.icon}
            <span>{action.label}</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
