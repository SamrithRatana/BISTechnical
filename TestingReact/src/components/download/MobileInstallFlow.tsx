"use client";

/**
 * @file components/download/MobileInstallFlow.tsx
 * @description The guided install timeline shown when the visitor is already
 * on a phone: mini hero with the (static-after-one-scan) phone, OS segmented
 * control, a three-step rail wired to the real install handlers, the Android
 * APK alternative, and a sticky bottom action bar. Step stamps are visual
 * progress only — nothing is persisted.
 */

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Cloud, Copy, Check, Download, PlusCircle, Zap } from "lucide-react";
import { useI18n } from "@/i18n/LanguageProvider";
import type { TranslationKey } from "@/i18n/translations";
import { AndroidIcon, AppleIcon } from "./PlatformIcons";
import PhoneMockup from "./PhoneMockup";
import InstallStep, { type InstallStepAction } from "./InstallStep";
import StickyActionBar from "./StickyActionBar";
import { PLATFORM_CONTENT } from "./platformContent";
import {
  ANDROID_PLAY_STORE_URL,
  EXPO_CLOUD_APP_URL,
  EXPO_PROJECT_HANDLE,
  IOS_APP_STORE_URL,
  type DownloadPlatform,
} from "./downloadConstants";
import { DUR } from "./motion";
import { usePwaInstallPrompt } from "./useDeviceType";
import type { DownloadActions } from "./useDownloadActions";
import type { DownloadMotionMode } from "./useDownloadMotionMode";

interface MobileInstallFlowProps {
  platform: DownloadPlatform;
  onSwitchTab: (platform: DownloadPlatform) => void;
  detected: DownloadPlatform;
  mode: DownloadMotionMode;
  actions: DownloadActions;
}

const STEP_LABEL_KEYS = ["download.stepLabel1", "download.stepLabel2", "download.stepLabel3"] as const;

export default function MobileInstallFlow({
  platform,
  onSwitchTab,
  detected,
  mode,
  actions,
}: MobileInstallFlowProps) {
  const { t } = useI18n();
  const deferredPrompt = usePwaInstallPrompt();
  const [stamped, setStamped] = useState<Record<DownloadPlatform, number[]>>({
    android: [],
    ios: [],
  });
  const [apkOpen, setApkOpen] = useState(false);

  const content = PLATFORM_CONTENT[platform];
  const isAndroid = platform === "android";
  const Icon = isAndroid ? AndroidIcon : AppleIcon;
  const railGradient = isAndroid
    ? "linear-gradient(180deg, rgb(52 211 153 / 0.6), rgb(20 184 166 / 0.2))"
    : "linear-gradient(180deg, rgb(34 211 238 / 0.6), rgb(59 130 246 / 0.2))";

  const stamp = (i: number) =>
    setStamped((prev) =>
      prev[platform].includes(i)
        ? prev
        : { ...prev, [platform]: [...prev[platform], i] }
    );

  const steps: Array<{ titleKey: TranslationKey; bodyKey: TranslationKey; action: InstallStepAction }> = [
    {
      titleKey: "download.step1Title",
      bodyKey: content.stepBodyKeys.step1Body,
      action: {
        label: t(content.stepBodyKeys.step1Cta),
        href: isAndroid ? ANDROID_PLAY_STORE_URL : IOS_APP_STORE_URL,
        icon: <Icon className="w-4 h-4" />,
        onClick: () => stamp(0),
      },
    },
    {
      titleKey: "download.step2Title",
      bodyKey: content.stepBodyKeys.step2Body,
      action: {
        label: t("download.step2Cta"),
        icon: <Zap className="w-4 h-4" />,
        onClick: () => {
          stamp(1);
          actions.handleOpenExpo();
        },
      },
    },
    {
      titleKey: content.stepBodyKeys.step3Title,
      bodyKey: content.stepBodyKeys.step3Body,
      action: {
        label: t(content.stepBodyKeys.step3Cta),
        icon: <PlusCircle className="w-4 h-4" />,
        onClick: () => {
          stamp(2);
          if (isAndroid) {
            void actions.handleAddToAndroidHome(deferredPrompt);
          } else {
            actions.handleInstallIosWebClip();
          }
        },
      },
    },
  ];

  const doneSet = stamped[platform];
  const currentIndex = [0, 1, 2].find((i) => !doneSet.includes(i)) ?? 1;

  return (
    <main className="mx-auto w-full max-w-md px-4 pb-32 pt-24">
      {/* Mini hero */}
      <div className="mb-6 flex flex-col items-center text-center">
        <h1 className="text-2xl font-black tracking-tight text-white">
          {t("download.mobileTitle")}
        </h1>
        <p className="mt-1 max-w-xs text-xs text-slate-400">{t(content.subtitleKey)}</p>

        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            detected === "android"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {t(detected === "android" ? "download.detectedAndroid" : "download.detectedIos")}
        </span>

        <div className="my-5">
          <PhoneMockup mode={mode} size="mini" />
        </div>

        {/* Cloud project pill */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-xs text-slate-300">
          <Cloud className="w-3.5 h-3.5 text-cyan-400" />
          <span>{EXPO_PROJECT_HANDLE}</span>
          <button
            type="button"
            onClick={() => actions.copyToClipboard(EXPO_CLOUD_APP_URL, t("download.cloudUrlLabel"))}
            className="cursor-pointer rounded-md p-1 transition-colors hover:bg-white/10"
          >
            {actions.hasCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* OS segmented control */}
      <div className="mb-5 flex items-center justify-center">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["android", "ios"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSwitchTab(key)}
              className={`relative cursor-pointer rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                platform === key ? "text-slate-950" : "text-slate-400"
              }`}
            >
              {platform === key && (
                <motion.span
                  layoutId="dl-os-pill"
                  className={`absolute inset-0 rounded-lg ${key === "android" ? "bg-emerald-400" : "bg-cyan-400"}`}
                  transition={{ duration: DUR.panel }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {key === "android" ? <AndroidIcon className="w-3.5 h-3.5" /> : <AppleIcon className="w-3.5 h-3.5" />}
                {key === "android" ? "Android" : "iOS"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
        {t("download.stepByStep")}
      </p>

      {/* The rail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={platform}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: DUR.panel }}
        >
          <div className="relative">
            <div
              className="absolute bottom-6 left-[15px] top-6 w-[2px]"
              style={{ background: railGradient }}
              aria-hidden
            />
            <div className="space-y-4">
              {steps.map((step, i) => (
                <InstallStep
                  key={step.titleKey}
                  index={i + 1}
                  stepLabelKey={STEP_LABEL_KEYS[i]}
                  titleKey={step.titleKey}
                  bodyKey={step.bodyKey}
                  action={step.action}
                  platform={platform}
                  done={doneSet.includes(i)}
                  current={i === currentIndex}
                  mode={mode}
                />
              ))}
            </div>
          </div>

          {/* Android-only APK alternative */}
          {isAndroid && (
            <div className="mt-5 rounded-2xl border border-dashed border-emerald-500/40 p-3.5">
              <button
                type="button"
                onClick={() => setApkOpen((prev) => !prev)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
              >
                <span>
                  <span className="block font-mono text-xs font-bold text-emerald-400">
                    CAM_ID.apk
                  </span>
                  <span className="block text-[11px] text-slate-400">{t("download.apkAltTitle")}</span>
                </span>
                <motion.span
                  className="inline-flex"
                  animate={{ rotate: apkOpen ? 180 : 0 }}
                  transition={{ duration: DUR.panel }}
                >
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.span>
              </button>
              <AnimatePresence>
                {apkOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: DUR.panel }}
                    className="space-y-2.5 pt-3"
                  >
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {t("download.apkAltBody")}
                    </p>
                    <button
                      type="button"
                      onClick={actions.handleDownloadApk}
                      className="flex w-full min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition-transform duration-150 active:scale-[0.98]"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t("download.apkAltCta")}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-6 text-center text-[11px] text-slate-600">
        {t("download.securityFootnote")}
      </p>

      <StickyActionBar
        action={steps[currentIndex].action}
        platform={platform}
        hasCopied={actions.hasCopied}
        onCopy={() => actions.copyToClipboard(EXPO_CLOUD_APP_URL, t("download.cloudUrlLabel"))}
      />
    </main>
  );
}
