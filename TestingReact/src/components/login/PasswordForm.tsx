"use client";

/**
 * @file components/login/PasswordForm.tsx
 * @description The credentials form: cascading field reveal, the Prismwell
 * focus treatment (gradient rim + target-lock corner ticks + pre-painted
 * elevation shadow, all CSS-only via focus-within so typing never touches
 * framer), the gravity-snap primary action, secondary routes and the 1-click
 * demo personas.
 *
 * Focus visuals are opacity/transform crossfades of PRE-PAINTED layers —
 * never an animated box-shadow or repaint — and every CSS transition carries
 * `motion-reduce:transition-none` (globals.css deliberately leaves CSS alone
 * under data-lite, so this file gates itself).
 */

import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Lock, LogIn, Smartphone, User } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import { CornerTicks, FocusChrome } from "./FocusChrome";
import { DUR, LOAD, REVEAL_EASE } from "./motion";
import OtherMethodsButton from "./OtherMethodsButton";
import type { HoloTriad } from "./color";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface PasswordFormProps {
  userName: string;
  password: string;
  showPassword: boolean;
  isLoading: boolean;
  loginSuccess: boolean;
  holo: HoloTriad;
  mode: LoginMotionMode;
  onUserNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onOpenSelector: () => void;
  onDownload: () => void;
  onPersona?: (user: string, pass: string) => void;
}

const INPUT_CLASS =
  "relative w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-[12px] sm:text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-300/90 rounded-xl focus:outline-none focus:border-transparent dark:bg-slate-950/80 dark:hover:bg-slate-950/90 dark:focus:bg-slate-950 dark:text-white dark:placeholder-slate-500 dark:border-white/[0.12] transition-colors font-medium shadow-xs";

export default function PasswordForm({
  userName,
  password,
  showPassword,
  isLoading,
  loginSuccess,
  holo,
  mode,
  onUserNameChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
  onOpenSelector,
  onDownload,
  onPersona: _onPersona,
}: PasswordFormProps) {
  const { lang, t } = useI18n();
  const full = mode === "full";

  // Cascading reveal: each row settles a beat after the previous one.
  const row = (order: number) =>
    full
      ? {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: DUR.reveal,
            delay: LOAD.formDelay + order * LOAD.formStagger,
            ease: REVEAL_EASE,
          },
        }
      : { initial: false as const, animate: { opacity: 1, y: 0 } };

  return (
    <motion.form
      key="auth-method-password"
      initial={{ opacity: 0, x: -20, rotateY: full ? 4 : 0 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      exit={{ opacity: 0, x: 20, rotateY: full ? -4 : 0 }}
      transition={full ? { duration: DUR.panel, ease: "easeOut" } : { duration: 0 }}
      onSubmit={onSubmit}
      method="post"
      className="space-y-1 sm:space-y-1.5 xl:space-y-2"
      autoComplete="on"
    >
      <motion.div {...row(0)} className="space-y-0.5 sm:space-y-1">
        <label htmlFor="username" className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {t("login.username")}
        </label>
        <div className="relative group focus-within:-translate-y-px transition-transform duration-200 motion-reduce:transition-none">
          <FocusChrome holo={holo} />
          <User className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <input
            id="username"
            name="username"
            type="text"
            required
            autoComplete="username"
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            placeholder={t("login.usernamePlaceholder")}
            className={INPUT_CLASS}
          />
          <CornerTicks holo={holo} />
        </div>
      </motion.div>

      <motion.div {...row(1)} className="space-y-0.5 sm:space-y-1">
        <label htmlFor="password" className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {t("login.password")}
        </label>
        <div className="relative group focus-within:-translate-y-px transition-transform duration-200 motion-reduce:transition-none">
          <FocusChrome holo={holo} />
          <Lock className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={t("login.passwordPlaceholder")}
            className={`${INPUT_CLASS} pr-9`}
          />
          <CornerTicks holo={holo} />
          <button
            type="button"
            onClick={onToggleShowPassword}
            aria-label={
              showPassword
                ? lang === "km"
                  ? "លាក់លេខសម្ងាត់"
                  : "Hide password"
                : lang === "km"
                  ? "បង្ហាញលេខសម្ងាត់"
                  : "Show password"
            }
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-0.5 z-10"
          >
            {showPassword ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </motion.div>

      <motion.div {...row(2)} className="flex items-center justify-between text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            defaultChecked
            className="w-3 h-3 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-slate-950 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            style={{ accentColor: holo.a }}
          />
          <span className="text-slate-600 dark:text-slate-300 font-normal">{t("login.rememberMe")}</span>
        </label>
        <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium">
          {t("login.forgotPassword")}
        </span>
      </motion.div>

      {/* Primary action: shine sweep at rest, gravity-snap pulse + honest
          progress bar while the pipeline runs */}
      <motion.div {...row(3)}>
        <motion.button
          type="submit"
          disabled={isLoading || loginSuccess}
          animate={full && isLoading ? { scale: [1, 0.97, 1.01, 1] } : { scale: 1 }}
          transition={{ duration: 0.3, times: [0, 0.4, 0.75, 1] }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: `linear-gradient(135deg, ${holo.a} 0%, ${holo.a}d9 100%)`,
            boxShadow: `0 6px 20px ${holo.a}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
          }}
          className="w-full py-1.5 sm:py-2 xl:py-2.5 rounded-xl text-white font-bold text-xs sm:text-[12.5px] flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer relative overflow-hidden group"
        >
          {/* Hover: interior hue warms toward the companion tones */}
          <span
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 motion-reduce:transition-none"
            style={{
              background: `linear-gradient(135deg, ${holo.b}33, transparent 50%, ${holo.c}26)`,
            }}
          />
          {!isLoading && (
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 motion-reduce:transition-none bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          )}
          {full && isLoading && (
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute bottom-0 left-0 right-0 h-[3px] origin-left bg-white/40 pointer-events-none"
            />
          )}
          <LogIn className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" />
          <span>
            {isLoading
              ? t("login.signingIn")
              : loginSuccess
                ? lang === "km"
                  ? "✓ ជោគជ័យ"
                  : "✓ Success"
                : t("login.signInToPortal")}
          </span>
        </motion.button>
      </motion.div>

      <motion.div {...row(4)}>
        <OtherMethodsButton onClick={onOpenSelector} />
      </motion.div>

      <motion.div {...row(5)}>
        <motion.button
          type="button"
          whileHover={{ scale: 1.015, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onDownload}
          className="w-full py-1 sm:py-1.5 xl:py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200/90 hover:border-cyan-400 text-cyan-700 hover:text-cyan-900 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 dark:border-cyan-500/30 dark:hover:border-cyan-400/60 dark:text-cyan-300 dark:hover:text-white text-[10.5px] sm:text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs group"
        >
          <Smartphone className="w-3 h-3 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform motion-reduce:transition-none" />
          <span>
            {lang === "km"
              ? "ទាញយក CAM ID App (Android & iOS)"
              : "Get CAM ID Mobile App (Android & iOS)"}
          </span>
          <ArrowRight className="w-3 h-3 text-cyan-600 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform motion-reduce:transition-none" />
        </motion.button>
      </motion.div>
    </motion.form>
  );
}
