"use client";

/**
 * @file components/login/SignInColumn.tsx
 * @description The active sign-in column: brand header with the click-to-
 * switch method badge, the error banner, and the animated stack that swaps
 * between the password form, the passkey panel, the phone-QR panel and the
 * face-verification stage.
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { AuthMethod } from "./authMethodStore";
import { AUTH_METHODS } from "./constants";
import BrandChip from "./BrandChip";
import PasswordForm from "./PasswordForm";
import { FaceStagePanel, PasskeyPanel, PhonePanel } from "./AuthPanels";
import type { AuthFlows } from "./useAuthFlows";
import type { HoloTriad } from "./color";
import type { LoginPipeline } from "./useLoginPipeline";
import type { LoginMotionMode } from "./useLoginMotionMode";

interface SignInColumnProps {
  authMethod: AuthMethod;
  motionMode: LoginMotionMode;
  holo: HoloTriad;
  pipeline: LoginPipeline;
  flows: AuthFlows;
  userName: string;
  password: string;
  showPassword: boolean;
  onUserNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onToggleShowPassword: () => void;
  onOpenSelector: () => void;
  onDownload: () => void;
  onPersona: (user: string, pass: string) => void;
  onPhoneCancel: () => void;
}

export default function SignInColumn({
  authMethod,
  motionMode,
  holo,
  pipeline,
  flows,
  userName,
  password,
  showPassword,
  onUserNameChange,
  onPasswordChange,
  onToggleShowPassword,
  onOpenSelector,
  onDownload,
  onPersona,
  onPhoneCancel,
}: SignInColumnProps) {
  const { lang, t } = useI18n();
  const activeTag = AUTH_METHODS.find((m) => m.id === authMethod)?.tag || "Sign In";

  return (
    <div className="space-y-1.5 sm:space-y-2 xl:space-y-3 max-w-[310px] sm:max-w-[330px] xl:max-w-[350px] mx-auto w-full">
      {/* Header: brand chip + active-method badge */}
      <div className="space-y-0.5 sm:space-y-1">
        <div className="flex items-center justify-between">
          <div className="relative inline-block">
            <div
              className="absolute -inset-1 rounded-2xl opacity-60 blur-md pointer-events-none"
              style={{ backgroundColor: `${holo.a}40` }}
            />
            <BrandChip className="relative" size="sm" />
          </div>

          <button
            type="button"
            onClick={onOpenSelector}
            className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/15 hover:bg-emerald-500/20 dark:hover:bg-emerald-500/25 border border-emerald-500/30 dark:border-emerald-500/35 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer shadow-xs"
            title={lang === "km" ? "ចុចដើម្បីជ្រើសរើសរបៀប Sign In ផ្សេងទៀត" : "Click to Switch Sign-In Method"}
          >
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 ${motionMode === "full" ? "animate-pulse" : ""}`} />
            <span>{activeTag}</span>
            <span className="text-emerald-600 dark:text-emerald-400/80 font-normal">⇋</span>
          </button>
        </div>

        <h2 className="text-lg sm:text-xl xl:text-[23px] font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:via-slate-100 dark:to-slate-400 tracking-tight leading-tight pt-0.5">
          {t("login.welcome")}
        </h2>
        <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 dark:text-slate-400 font-normal">{t("login.subtitle")}</p>
      </div>

      {pipeline.errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={
            motionMode === "full"
              ? { opacity: 1, y: 0, rotateZ: [0, -0.6, 0.6, 0] }
              : { opacity: 1, y: 0 }
          }
          transition={
            motionMode === "full"
              ? { duration: 0.3, rotateZ: { duration: 0.3, times: [0, 0.3, 0.6, 1] } }
              : { duration: 0 }
          }
          className="p-2 sm:p-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
          <span className="text-xs">{pipeline.errorMsg}</span>
        </motion.div>
      )}

      {/* Active method content — local perspective so the panels' rotateY
          turn-ins project (flat ancestors are fine, the projection is local) */}
      <div className="[perspective:900px]">
        <AnimatePresence mode="wait">
        {flows.faceStage ? (
          <FaceStagePanel
            key="face-stage"
            attemptsLeft={flows.faceStage.attemptsLeft}
            faceError={flows.faceError}
            busy={flows.faceBusy}
            onComplete={(d) => void flows.handleFaceCaptured(d)}
            onCancel={flows.cancelFaceStage}
          />
        ) : authMethod === "phone" ? (
          <PhonePanel
            key="phone-panel"
            onDone={flows.handlePhoneLoginDone}
            onCancel={onPhoneCancel}
            onOpenSelector={onOpenSelector}
          />
        ) : authMethod === "passkey" ? (
          <PasskeyPanel
            key="passkey-panel"
            accentHex={holo.a}
            busy={flows.passkeyBusy}
            disabled={pipeline.isLoading || pipeline.loginSuccess}
            onLogin={() => void flows.handlePasskeyLogin(userName)}
            onOpenSelector={onOpenSelector}
          />
        ) : (
          <PasswordForm
            key="password-form"
            userName={userName}
            password={password}
            showPassword={showPassword}
            isLoading={pipeline.isLoading}
            loginSuccess={pipeline.loginSuccess}
            holo={holo}
            mode={motionMode}
            onUserNameChange={onUserNameChange}
            onPasswordChange={onPasswordChange}
            onToggleShowPassword={onToggleShowPassword}
            onSubmit={(e) => void flows.handleLogin(e, userName, password)}
            onOpenSelector={onOpenSelector}
            onDownload={onDownload}
            onPersona={onPersona}
          />
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
