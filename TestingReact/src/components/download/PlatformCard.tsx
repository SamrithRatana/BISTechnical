"use client";

/**
 * @file components/download/PlatformCard.tsx
 * @description One card, two platforms — everything platform-specific comes
 * from `platformContent.ts` plus the accent map below (full literal class
 * names so Tailwind's compiler sees them).
 *
 * The card micro-tilts ±3° under a fine pointer, but tilt is FORCED to
 * identity while its QR panel is open: a QR rasterized under a 3D transform
 * can render at an angle and stop scanning. The surface is a SOLID fill for
 * the same 3D reasons (see PhoneRig's header comment).
 *
 * Panel expansion animates opacity/y only; the card's height change is
 * deliberately instant (transform/opacity-only rule) and masked by the slide.
 */

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCircle2, ChevronDown, Copy, Info } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { AndroidIcon, AppleIcon } from "./PlatformIcons";
import PlatformDetails from "./PlatformDetails";
import QrPanel from "./QrPanel";
import { CARD_TILT_RANGE, DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import { useTiltRig } from "./useTiltRig";
import type { DownloadMotionMode } from "./useDownloadMotionMode";
import type { PlatformContent } from "./platformContent";

interface PlatformCardProps {
  content: PlatformContent;
  mode: DownloadMotionMode;
  qrOpen: boolean;
  onToggleQr: () => void;
  qrDataUrl: string;
  pageUrl: string;
  hasCopied: boolean;
  onCopyLink: () => void;
  entranceDelay: number;
}

const ACCENT = {
  android: {
    border: "border-emerald-500/25",
    glow: "shadow-[0_0_80px_-20px_rgb(16_185_129/0.25)]",
    hairline: "linear-gradient(90deg, rgb(52 211 153 / 0.9), rgb(34 211 238 / 0.3), transparent)",
    tile: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300",
    tag: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    check: "text-emerald-400",
    primary: "bg-emerald-500 text-slate-950 shadow-[0_10px_30px_-10px_rgb(16_185_129/0.5)]",
    detailsActive: "border-emerald-400/60 bg-emerald-500/15 text-emerald-300",
    infoTint: "text-emerald-400",
  },
  ios: {
    border: "border-cyan-500/25",
    glow: "shadow-[0_0_80px_-20px_rgb(6_182_212/0.25)]",
    hairline: "linear-gradient(90deg, rgb(34 211 238 / 0.9), rgb(52 211 153 / 0.3), transparent)",
    tile: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    badge: "bg-cyan-500/20 text-cyan-300",
    tag: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
    check: "text-cyan-400",
    primary: "bg-cyan-500 text-slate-950 shadow-[0_10px_30px_-10px_rgb(6_182_212/0.5)]",
    detailsActive: "border-cyan-400/60 bg-cyan-500/15 text-cyan-300",
    infoTint: "text-cyan-400",
  },
} as const;

const panelMotion = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: DUR.panel },
} as const;

export default function PlatformCard({
  content,
  mode,
  qrOpen,
  onToggleQr,
  qrDataUrl,
  pageUrl,
  hasCopied,
  onCopyLink,
  entranceDelay,
}: PlatformCardProps) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const full = mode === "full";
  const a = ACCENT[content.key];
  const rig = useTiltRig(CARD_TILT_RANGE, CARD_TILT_RANGE, !full || qrOpen);
  const Icon = content.key === "android" ? AndroidIcon : AppleIcon;

  return (
    <div className="[perspective:800px]">
      <motion.div
        className={`relative overflow-hidden rounded-3xl border bg-[#0a0f16] p-5 sm:p-7 ${a.border} ${a.glow}`}
        onPointerMove={rig.onPointerMove}
        onPointerLeave={rig.onPointerLeave}
        style={{ rotateX: rig.rotateX, rotateY: rig.rotateY }}
        initial={full ? { opacity: 0, y: 32 } : false}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT_ONCE}
        transition={{ duration: DUR.card, delay: entranceDelay, ease: REVEAL_EASE }}
        whileHover={full ? { y: -4 } : undefined}
      >
        {/* Platform-gradient top hairline (sanctioned gradient appearance) */}
        <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: a.hairline }} />

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${a.tile}`}>
              <Icon className="w-7 h-7" />
            </div>
            <div>
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
                <span>{content.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.badge}`}>
                  {t(content.badgeKey)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">{t(content.devicesKey)}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${a.tag}`}>
            {t(content.tagKey)}
          </span>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-slate-300">{t(content.descKey)}</p>

        {/* Feature checklist */}
        <div className="mb-4 space-y-2 text-xs text-slate-300">
          {content.featureKeys.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${a.check}`} />
              <span>{t(key)}</span>
            </div>
          ))}
        </div>

        {/* In-place QR reveal */}
        <AnimatePresence>
          {qrOpen && (
            <motion.div {...panelMotion}>
              <QrPanel
                content={content}
                dataUrl={qrDataUrl}
                pageUrl={pageUrl}
                hasCopied={hasCopied}
                onCopy={onCopyLink}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Details accordion */}
        <AnimatePresence>
          {detailsOpen && (
            <motion.div {...panelMotion}>
              <PlatformDetails content={content} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="space-y-2.5 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onToggleQr}
            className={`flex w-full min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-xs font-bold transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] sm:text-sm ${a.primary}`}
          >
            <Icon className="w-5 h-5" />
            <span>{t(content.downloadCtaKey)}</span>
            <motion.span
              className="ml-1 inline-flex"
              animate={{ rotate: qrOpen ? 180 : 0 }}
              transition={{ duration: DUR.panel }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              className={`flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                detailsOpen
                  ? a.detailsActive
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"
              }`}
            >
              <Info className={`w-3.5 h-3.5 ${a.infoTint}`} />
              <span>{detailsOpen ? t("download.detailsHide") : t("download.detailsShow")}</span>
              <motion.span
                className="inline-flex"
                animate={{ rotate: detailsOpen ? 180 : 0 }}
                transition={{ duration: DUR.panel }}
              >
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </motion.span>
            </button>

            <button
              type="button"
              onClick={onCopyLink}
              className="flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-white/25"
            >
              {hasCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className={`w-3.5 h-3.5 ${a.infoTint}`} />
              )}
              <span>{t("download.copyLink")}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
