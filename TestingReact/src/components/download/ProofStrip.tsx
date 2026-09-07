"use client";

/**
 * @file components/download/ProofStrip.tsx
 * @description The proof pipeline — four metric cells telling the scan story
 * (SCAN → SENSE → MATCH → UNLOCK) over one machined band. The connector line
 * "draws" by sliding a cover away (transform-only, never a width animation),
 * and the 59 counts up as its cell lands. Step numbers are English-only mono
 * micro-labels (see ScanScreen's language note); everything else is bilingual.
 */

import React, { useRef } from "react";
import { animate, motion, type Variants } from "framer-motion";
import { Cpu, Lock, ScanFace, Zap, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { DUR, REVEAL_EASE, VIEWPORT_ONCE } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

interface Cell {
  step: string;
  icon: LucideIcon;
  tint: string;
  figure: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  countUp?: boolean;
}

const CELLS: readonly Cell[] = [
  { step: "01 · SCAN", icon: ScanFace, tint: "text-cyan-400", figure: "ArcFace", titleKey: "download.matrix3Title", bodyKey: "download.matrix3Body" },
  { step: "02 · SENSE", icon: Cpu, tint: "text-emerald-400", figure: "3D", titleKey: "download.matrix2Title", bodyKey: "download.matrix2Body" },
  // The one sanctioned amber accent on the page.
  { step: "03 · MATCH", icon: Zap, tint: "text-amber-300", figure: "59", titleKey: "download.matrix1Title", bodyKey: "download.matrix1Body", countUp: true },
  { step: "04 · UNLOCK", icon: Lock, tint: "text-emerald-400", figure: "0", titleKey: "download.matrix4Title", bodyKey: "download.matrix4Body" },
];

const cellVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: DUR.reveal, delay: i * 0.09, ease: REVEAL_EASE },
  }),
};

function CountUpFigure({ active }: { active: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <motion.span
      ref={ref}
      className="inline-block min-w-[2ch] text-right"
      onViewportEnter={() => {
        if (!active || !ref.current) return;
        const controls = animate(0, 59, {
          duration: DUR.count,
          onUpdate: (v) => {
            if (ref.current) ref.current.textContent = String(Math.round(v));
          },
        });
        // One-shot on entry; nothing to clean up on exit (viewport once).
        void controls;
      }}
      viewport={VIEWPORT_ONCE}
    >
      59
    </motion.span>
  );
}

export default function ProofStrip({ mode }: { mode: DownloadMotionMode }) {
  const { t } = useI18n();
  const full = mode === "full";

  return (
    <section className="border-y border-white/5 py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.p
          className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-500"
          initial={full ? { opacity: 0, y: 12 } : false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_ONCE}
          transition={{ duration: DUR.reveal, ease: REVEAL_EASE }}
        >
          {t("download.matrixHeading")}
        </motion.p>

        {/* Connector line — cover slides away to "draw" the gradient */}
        <div className="relative mb-8 hidden h-[2px] overflow-hidden sm:block" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgb(34 211 238 / 0.6), rgb(52 211 153 / 0.6))",
            }}
          />
          {full && (
            <motion.div
              className="absolute inset-0 bg-[#06090e]"
              initial={{ x: "0%" }}
              whileInView={{ x: "100%" }}
              viewport={VIEWPORT_ONCE}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            />
          )}
          {CELLS.map((cell, i) => (
            <motion.span
              key={cell.step}
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-slate-200"
              style={{ left: `calc(${12.5 + i * 25}% - 4px)` }}
              initial={full ? { scale: 0 } : false}
              whileInView={{ scale: 1 }}
              viewport={VIEWPORT_ONCE}
              transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.09 }}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-white/5">
          {CELLS.map((cell, i) => (
            <motion.div
              key={cell.step}
              className="flex flex-col items-start gap-2 lg:px-8"
              custom={i}
              variants={cellVariants}
              initial={full ? "hidden" : false}
              whileInView="visible"
              viewport={VIEWPORT_ONCE}
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-600">
                {cell.step}
              </span>
              <span className="flex items-baseline gap-2">
                <cell.icon className={`w-5 h-5 self-center ${cell.tint}`} />
                <span className="text-4xl font-black tracking-tight text-white [font-variant-numeric:tabular-nums] sm:text-5xl">
                  {cell.countUp && full ? <CountUpFigure active /> : cell.figure}
                  {cell.countUp && <span className="text-xl font-bold text-slate-500">ms</span>}
                </span>
              </span>
              <span className="text-sm font-semibold text-slate-200">{t(cell.titleKey)}</span>
              <span className="min-h-[2.5rem] text-xs leading-relaxed text-slate-400">
                {t(cell.bodyKey)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
