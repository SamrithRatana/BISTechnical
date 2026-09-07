"use client";

/**
 * @file components/login/PipelineOverlay.tsx
 * @description The five-stage sign-in handshake overlay: node topology map +
 * live terminal trace. Purely presentational — `useLoginPipeline` owns the
 * state. The backdrop blur is a static CSS class (never animated), matching
 * the app's modal-backdrop rule; the progress line animates `scaleX`, not
 * `width`, per the transform/opacity-only rule.
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { HoloTriad } from "./color";
import { PIPELINE_NODES } from "./constants";
import { OVERLAY_SUMMON_DELAY } from "./motion";
import { useLoginMotionMode } from "./useLoginMotionMode";

interface PipelineOverlayProps {
  step: number;
  logs: string[];
  errorNodeId: number | null;
  holo: HoloTriad;
}

export default function PipelineOverlay({ step, logs, errorNodeId, holo }: PipelineOverlayProps) {
  const { lang } = useI18n();
  // Lite Mode gates the looping pulses too — globals.css deliberately leaves
  // CSS animation alone under data-lite, so this component must do it itself.
  const full = useLoginMotionMode() === "full";

  // Entrance only: the overlay is "summoned" by the submit button's pulse,
  // so it arrives a beat after the press. Exit is immediate. In static mode
  // (which includes Lite Mode alone — framer's useReducedMotion does NOT
  // cover it) everything lands instantly.
  const summonDelay = full ? OVERLAY_SUMMON_DELAY : 0;
  const instant = { duration: 0 } as const;

  return (
    <AnimatePresence>
      {step > 0 && (
        <motion.div
          initial={full ? { opacity: 0 } : false}
          animate={{ opacity: 1, transition: full ? { delay: summonDelay } : instant }}
          exit={full ? { opacity: 0 } : { opacity: 0, transition: instant }}
          className="fixed inset-0 z-50 bg-[#03060c]/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={full ? { scale: 0.92, y: 24, opacity: 0 } : false}
            animate={{
              scale: 1,
              y: 0,
              opacity: 1,
              transition: full
                ? { type: "spring", stiffness: 120, damping: 18, delay: summonDelay }
                : instant,
            }}
            exit={
              full
                ? { scale: 0.95, y: -20, opacity: 0 }
                : { opacity: 0, transition: instant }
            }
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className="w-full max-w-2xl bg-slate-900/95 border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl shadow-emerald-950/50 space-y-4 sm:space-y-6 relative overflow-hidden"
          >
            <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-sm shrink-0">
                  <Activity className={`w-4 h-4 sm:w-5 sm:h-5 ${full ? "animate-pulse" : ""}`} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {lang === "km"
                      ? "ដំណើរការតភ្ជាប់បណ្តាញប្រព័ន្ធសហគ្រាស"
                      : "Enterprise Network Pipeline Handshake"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">
                    {lang === "km"
                      ? "កំពុងផ្ទៀងផ្ទាត់សិទ្ធិ និងតភ្ជាប់ Microservices ទាំងអស់..."
                      : "Authenticating multi-tier microservices & establishing telemetry link..."}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 self-start sm:self-center">
                {lang === "km" ? `ជំហាន ${step}/5` : `Step ${step} of 5`}
              </span>
            </div>

            {/* Network node topology map */}
            <div className="relative py-2 sm:py-3 z-10">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-3 relative">
                <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-slate-800 hidden sm:block overflow-hidden rounded-full">
                  <motion.div
                    className="h-full w-full origin-left"
                    style={{
                      background: `linear-gradient(90deg, ${holo.a}, ${holo.b})`,
                      boxShadow: `0 0 12px ${holo.a}cc`,
                    }}
                    initial={full ? { scaleX: 0 } : false}
                    animate={{ scaleX: (step - 1) / 4 }}
                    transition={full ? { duration: 0.35, ease: "easeOut" } : { duration: 0 }}
                  />
                </div>

                {PIPELINE_NODES.map((node) => {
                  const NodeIcon = node.icon;
                  const isFailed = errorNodeId === node.id;
                  const isDone = step > node.id && !isFailed;
                  const isActive = step === node.id && !isFailed;

                  const failBadgeText = node.id === 2 ? "WRONG" : "DOWN";
                  const failDescText =
                    node.id === 2
                      ? lang === "km"
                        ? "គណនីមិនត្រឹមត្រូវ (Auth Failed)"
                        : "Invalid Credentials"
                      : lang === "km"
                        ? "មិនអាចភ្ជាប់បាន (API Down)"
                        : "Service Unreachable";

                  return (
                    <div key={node.id} className="flex flex-col items-center text-center space-y-1.5 relative">
                      <motion.div
                        animate={
                          full && isFailed
                            ? { scale: [1, 1.15, 1], rotate: [0, -6, 6, 0] }
                            : full && isActive
                              ? { scale: [1, 1.08, 1] }
                              : {}
                        }
                        transition={{ repeat: full && (isActive || isFailed) ? Infinity : 0, duration: 1.2 }}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center border transition-colors duration-300 relative ${
                          isFailed
                            ? "bg-rose-500/25 border-rose-500 text-rose-300 shadow-lg shadow-rose-950/60"
                            : isDone
                              ? "bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-950/40"
                              : isActive
                                ? "bg-emerald-500/30 border-emerald-300 text-emerald-200 ring-2 ring-emerald-400/50 shadow-xl shadow-emerald-900/60"
                                : "bg-slate-800/80 border-white/10 text-slate-500"
                        }`}
                      >
                        <NodeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        {isDone && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                        {isFailed && (
                          <span className="absolute -top-1 -right-1 px-1 rounded bg-rose-600 text-white font-mono text-[8px] font-black uppercase tracking-tighter">
                            {failBadgeText}
                          </span>
                        )}
                      </motion.div>

                      <div className="space-y-0.5">
                        <span
                          className={`text-[10px] sm:text-xs font-bold block leading-tight ${
                            isFailed
                              ? "text-rose-400"
                              : isDone || isActive
                                ? "text-emerald-300"
                                : "text-slate-500"
                          }`}
                        >
                          {lang === "km" ? node.titleKm : node.titleEn}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 leading-tight hidden sm:block">
                          {isFailed ? failDescText : lang === "km" ? node.descKm : node.descEn}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Terminal trace window */}
            <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3 sm:p-3.5 font-mono text-[10px] sm:text-xs space-y-1.5 shadow-inner relative z-10 max-h-32 overflow-y-auto">
              <div className="flex items-center justify-between text-slate-400 border-b border-white/5 pb-1 mb-1">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${full ? "animate-ping" : ""}`} />
                  <span>Real-time Telemetry Trace</span>
                </span>
                <span className="text-[9px] text-slate-400">
                  Port {PIPELINE_NODES[Math.max(0, step - 1)]?.port || "Auto"}
                </span>
              </div>
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    log.includes("FAILED") || log.includes("បរាជ័យ")
                      ? "text-rose-400 font-bold"
                      : log.includes("✓")
                        ? "text-emerald-300 font-bold"
                        : "text-slate-300"
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
