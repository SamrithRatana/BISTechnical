"use client";

/**
 * @file components/download/ScanScreen.tsx
 * @description The CAM ID app UI rendered on the mock phone's screen, and the
 * page's signature beat: a one-shot verification sequence on load — tick ring
 * fades in, one scanline sweep, the verdict chip stamps in "UNLOCKED · 59ms"
 * while the latency figure counts up. Afterwards only a small sweep wedge
 * idles. In static mode the sequence is skipped and the screen renders the
 * verified end state.
 *
 * The strings here are deliberately English-only telemetry (mono/uppercase
 * micro-labels): Khmer has no uppercase and letter-spacing breaks its shaping,
 * and every fact shown here also appears in bilingual body copy on the page.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, animate } from "framer-motion";
import { ScanFace, ShieldCheck, Wifi } from "lucide-react";
import { useSafeTimeout } from "@/hooks/useSafeTimeout";
import { DUR, LOAD, STAMP_SPRING } from "./motion";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

type ScanStage = "idle" | "scanning" | "verified";

interface ScanScreenProps {
  mode: DownloadMotionMode;
  size: "full" | "mini";
}

const SIZES = {
  full: {
    ring: "w-36 h-36 sm:w-40 sm:h-40",
    sweepRange: 110,
    latency: "text-3xl",
    pad: "px-5 py-4",
    chip: "min-w-[9rem] px-3 text-[10px]",
  },
  mini: {
    ring: "w-20 h-20",
    sweepRange: 52,
    latency: "text-lg",
    pad: "px-3 py-2.5",
    chip: "px-2 text-[8px] whitespace-nowrap",
  },
} as const;

export default function ScanScreen({ mode, size }: ScanScreenProps) {
  const isStatic = mode === "static";
  const [timedStage, setTimedStage] = useState<ScanStage>("idle");
  // Static mode renders the verified end state directly — derived, not set in
  // an effect, so a mid-session mode flip needs no state write.
  const stage: ScanStage = isStatic ? "verified" : timedStage;
  const countRef = useRef<HTMLSpanElement>(null);
  const later = useSafeTimeout();
  const s = SIZES[size];

  useEffect(() => {
    if (isStatic) return;
    later(() => setTimedStage("scanning"), LOAD.scanDelay * 1000);
    later(() => setTimedStage("verified"), (LOAD.scanDelay + 0.2 + DUR.sweep) * 1000);
  }, [isStatic, later]);

  useEffect(() => {
    if (stage !== "verified" || isStatic) return;
    const controls = animate(0, 59, {
      duration: DUR.count,
      onUpdate: (v) => {
        if (countRef.current) countRef.current.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [stage, isStatic]);

  const verified = stage === "verified";

  return (
    <div className={`relative flex h-full w-full flex-col ${s.pad} select-none`}>
      {/* Status bar */}
      {size === "full" && (
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>09:41</span>
          <span className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3" />
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </span>
        </div>
      )}

      {/* Face-scan ring */}
      <div className="flex flex-1 items-center justify-center">
        <div className={`relative ${s.ring}`}>
          {/* Dashed tick circle — appears as the scan begins */}
          <motion.div
            className="absolute -inset-2.5 rounded-full border border-dashed border-white/15"
            initial={false}
            animate={{ opacity: stage === "idle" ? 0 : 1 }}
            transition={{ duration: DUR.panel }}
          />
          {/* Conic gradient ring (sanctioned gradient appearance) */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 210deg, rgb(52 211 153 / 0.9), rgb(34 211 238 / 0.75), rgb(34 211 238 / 0.06), rgb(52 211 153 / 0.9))",
            }}
          />
          <div className="absolute inset-[3px] rounded-full bg-[#070b12]" />

          {/* Idle sweep wedge — the last remaining loop after the sequence.
              Mini (mobile) renders none: on phones the sequence runs once and
              then everything holds still. */}
          {verified && !isStatic && size === "full" && (
            <div className="absolute inset-[3px] rounded-full overflow-hidden">
              <div
                className="absolute inset-0 animate-[spin_4s_linear_infinite]"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgb(34 211 238 / 0.16), transparent 55deg)",
                }}
              />
            </div>
          )}

          {/* Schematic face silhouette — 1px, desaturated, deliberately not a portrait */}
          <div className="absolute inset-0 flex flex-col items-center justify-center opacity-50">
            <div className="h-[38%] w-[30%] rounded-full border border-slate-500/50" />
            <div className="mt-[6%] h-[16%] w-[52%] rounded-t-full border border-b-0 border-slate-500/40" />
          </div>

          {/* Verified glyph inside the ring */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{ opacity: verified ? 1 : 0 }}
            transition={{ duration: DUR.panel }}
          >
            <ScanFace className="w-5 h-5 text-emerald-300" />
          </motion.div>
        </div>
      </div>

      {/* One scanline sweep, once, inside the screen's own overflow-hidden */}
      {stage === "scanning" && (
        <motion.div
          className="pointer-events-none absolute left-3 right-3 top-1/2 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(103 232 249 / 0.9), transparent)",
            boxShadow: "0 0 18px 2px rgb(34 211 238 / 0.35)",
          }}
          initial={{ y: -s.sweepRange, opacity: 0 }}
          animate={{ y: s.sweepRange, opacity: [0, 1, 1, 0] }}
          transition={{ duration: DUR.sweep, ease: "easeInOut" }}
        />
      )}

      {/* Readout stack */}
      <div className="flex flex-col items-center gap-1 pb-1 text-center font-mono">
        <div className={`${s.latency} font-semibold tracking-tight text-slate-100 [font-variant-numeric:tabular-nums]`}>
          <span ref={countRef} className="inline-block min-w-[2ch] text-right">
            {isStatic ? "59" : "0"}
          </span>
          <span className="text-slate-400"> ms</span>
        </div>
        {size === "full" && (
          <>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              ArcFace · 3D depth
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-600">FAR 1 : 1M</div>
          </>
        )}
        {/* Verdict chip — fixed min-width so the stamp causes zero layout shift */}
        <div className="mt-1 h-6">
          <motion.div
            className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 py-0.5 font-bold uppercase tracking-widest text-emerald-300 [font-variant-numeric:tabular-nums] ${s.chip}`}
            style={{ transformOrigin: "bottom" }}
            initial={false}
            animate={verified ? { opacity: 1, rotateX: 0 } : { opacity: 0, rotateX: -90 }}
            transition={isStatic ? { duration: 0 } : STAMP_SPRING}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Unlocked · 59ms</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
