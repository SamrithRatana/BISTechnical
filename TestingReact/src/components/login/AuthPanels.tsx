"use client";

/**
 * @file components/login/AuthPanels.tsx
 * @description The non-password sign-in panels: hardware passkey, CAM ID
 * phone (QR), and the face-verification second-factor stage. Presentation
 * only — the page owns the handlers and the pipeline.
 */

import React from "react";
import { motion } from "framer-motion";
import { Fingerprint, ScanFace } from "lucide-react";
import FaceCapture from "@/components/FaceCapture";
import FaceLinkQr from "@/components/FaceLinkQr";
import { useI18n } from "@/i18n/LanguageProvider";
import { DUR } from "./motion";
import OtherMethodsButton from "./OtherMethodsButton";
import { useLoginMotionMode } from "./useLoginMotionMode";

// ─── Passkey ────────────────────────────────────────────────────────────────

interface PasskeyPanelProps {
  accentHex: string;
  busy: boolean;
  disabled: boolean;
  onLogin: () => void;
  onOpenSelector: () => void;
}

export function PasskeyPanel({ accentHex, busy, disabled, onLogin, onOpenSelector }: PasskeyPanelProps) {
  const { lang, t } = useI18n();
  const full = useLoginMotionMode() === "full";

  return (
    <motion.div
      key="auth-method-passkey"
      initial={{ opacity: 0, x: 20, rotateY: full ? -4 : 0 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      exit={{ opacity: 0, x: -20, rotateY: full ? 4 : 0 }}
      transition={full ? { duration: DUR.panel, ease: "easeOut" } : { duration: 0 }}
      className="space-y-2.5 py-1 text-center"
    >
      <div className="p-4 rounded-2xl bg-gradient-to-b from-teal-500/10 to-transparent border border-teal-500/30 flex flex-col items-center justify-center space-y-2 relative overflow-hidden group">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/40 shadow-lg shadow-teal-950/50 group-hover:scale-105 transition-transform motion-reduce:transition-none">
          <Fingerprint className={`w-7 h-7 text-teal-400 ${full ? "animate-pulse" : ""}`} />
        </div>
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {lang === "km" ? "ចូលដោយប្រើ Passkey ឬ ជីវមាត្រ" : "Passkey & Biometrics (iOS / Android / PC)"}
          </h4>
          <p className="text-[10.5px] text-slate-500 dark:text-slate-400 max-w-[280px] mx-auto leading-snug">
            {lang === "km"
              ? "ផ្ទៀងផ្ទាត់តាមរយៈ iOS iCloud Keychain (Face ID / Touch ID), Android ឬ Windows Hello។"
              : "Instant sign in with Apple iCloud Keychain (Face ID / Touch ID), Android, or Windows Hello."}
          </p>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onLogin}
        disabled={disabled || busy}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        style={{
          background: `linear-gradient(135deg, ${accentHex} 0%, ${accentHex}d9 100%)`,
          boxShadow: `0 6px 20px ${accentHex}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
        className="w-full py-2.5 rounded-xl text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
      >
        <ScanFace className="w-4 h-4" />
        <span>{busy ? t("passkey.waiting") : t("passkey.signIn")}</span>
      </motion.button>

      <OtherMethodsButton onClick={onOpenSelector} />
    </motion.div>
  );
}

// ─── CAM ID phone (QR) ──────────────────────────────────────────────────────

interface PhonePanelProps {
  onDone: (payload: unknown) => void;
  onCancel: () => void;
  onOpenSelector: () => void;
}

export function PhonePanel({ onDone, onCancel, onOpenSelector }: PhonePanelProps) {
  const full = useLoginMotionMode() === "full";

  return (
    <motion.div
      key="auth-method-phone"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={full ? { duration: DUR.panel, ease: "easeOut" } : { duration: 0 }}
      className="space-y-2.5"
    >
      <FaceLinkQr mode="login" onDone={onDone} onCancel={onCancel} />
      <OtherMethodsButton onClick={onOpenSelector} />
    </motion.div>
  );
}

// ─── Face verification (second factor after password) ───────────────────────

interface FaceStagePanelProps {
  attemptsLeft: number;
  faceError: string;
  busy: boolean;
  onComplete: (descriptors: number[][]) => void;
  onCancel: () => void;
}

export function FaceStagePanel({ attemptsLeft, faceError, busy, onComplete, onCancel }: FaceStagePanelProps) {
  const { t } = useI18n();
  const full = useLoginMotionMode() === "full";

  return (
    <motion.div
      key="face-stage-verify"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={full ? undefined : { duration: 0 }}
      className="space-y-3"
    >
      <div className="text-center">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t("face.confirmTitle")}</h3>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t("face.confirmHint")}</p>
      </div>

      {/* Remount per attempt so the camera flow restarts cleanly. */}
      <FaceCapture key={attemptsLeft} mode="verify" busy={busy} onComplete={onComplete} onCancel={onCancel} />

      {faceError && (
        <p className="text-center text-[11px] font-semibold text-rose-500 dark:text-rose-300">{faceError}</p>
      )}
      <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
        {t("face.attemptsLeft", { count: String(attemptsLeft) })}
      </p>
    </motion.div>
  );
}
