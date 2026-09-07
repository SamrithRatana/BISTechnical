"use client";

/**
 * @file download/ios/page.tsx
 * @description Dedicated Apple iOS Mobile Installation Hub with Structured Step-by-Step Flow
 * and Intelligent Android Platform Mismatch Detection & Warning.
 */

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Smartphone,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Cloud,
  Zap,
  PlusCircle,
  Globe,
  Lock,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const IOS_APP_STORE_URL = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_CLOUD_APP_URL = "exp://u.expo.dev/cacb17a6-21d6-4b45-abf1-aab99521f61e?channel-name=master";

// Custom Apple & Android SVG Icons
function AppleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.75 1.04-1.8 0.92-2.87-.92.04-2.01.62-2.66 1.37-.57.65-.89 1.69-.95 2.76 1.04.08 2.08-.51 2.69-1.26z" />
    </svg>
  );
}

function AndroidIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.411 13.8533 8.081 12 8.081c-1.8534 0-3.5903.33-5.1368.8687L4.8409 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.343 14.588.0002 18.72h23.9996c-.3428-4.132-2.6887-7.5333-6.1196-9.3986" />
    </svg>
  );
}

export default function IosDownloadPage() {
  const router = useRouter();
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Platform Mismatch State (e.g. Android user scanned iOS QR)
  const [isAndroidDevice, setIsAndroidDevice] = useState<boolean>(false);
  const [showMismatchModal, setShowMismatchModal] = useState<boolean>(false);

  // Detect Android Device accessing iOS Hub
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || navigator.vendor || "";
    const isAndroid = /Android/.test(ua);
    if (isAndroid) {
      setIsAndroidDevice(true);
      setShowMismatchModal(true);
    }
  }, []);

  const copyToClipboard = useCallback((text: string, showToast = true) => {
    try {
      navigator.clipboard.writeText(text);
      setHasCopied(true);
      if (showToast) {
        toast.success("បានចម្លង Link ចូល Memory ទូរស័ព្ទរួចរាល់!", { duration: 3000 });
      }
      setTimeout(() => setHasCopied(false), 3000);
    } catch {}
  }, []);

  const handleOpenExpo = () => {
    copyToClipboard(EXPO_CLOUD_APP_URL, false);
    toast("កំពុងបើកដំណើរការ CAM ID ក្នុង Expo Go...", { icon: "🚀", duration: 2500 });
    window.location.href = EXPO_CLOUD_APP_URL;
  };

  const handleInstallWebClip = () => {
    copyToClipboard(EXPO_CLOUD_APP_URL, false);
    toast.success("កំពុងទាញយក Profile Icon CAM ID... សូមចុច Allow (អនុញ្ញាត)!", { duration: 4000 });
    window.location.href = "/api/camid-profile";
  };

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none font-sans">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-cyan-500/20 via-blue-600/15 to-indigo-500/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center">
        {/* Top App Logo & iOS Badge */}
        <div className="relative mb-3">
          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-600 p-0.5 shadow-xl shadow-cyan-500/25 flex items-center justify-center">
            <div className="w-full h-full bg-[#090d16] rounded-[22px] flex flex-col items-center justify-center">
              <ShieldCheck className="w-9 h-9 text-cyan-400" />
            </div>
          </div>
          <span className="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-cyan-500 text-[10px] font-bold text-slate-950 uppercase tracking-wider shadow-md flex items-center gap-1">
            <Cloud className="w-3 h-3 text-slate-950 fill-slate-950" />
            Apple iOS
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-1">
          CAM ID Mobile
        </h1>
        <p className="text-xs text-slate-400 max-w-xs mb-3">
          Apple Face ID & Instant Companion Authenticator
        </p>

        {/* Cloud Project Pill */}
        <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-800/80 border border-cyan-500/30 text-xs text-cyan-300 font-mono shadow-sm">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>@ratana2012/cam-id</span>
          <button
            type="button"
            onClick={() => copyToClipboard(EXPO_CLOUD_APP_URL, true)}
            title="ចម្លង Link"
            className="p-1 hover:bg-slate-750 rounded-md transition-colors cursor-pointer text-cyan-400"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STRUCTURED STEP-BY-STEP INSTALLATION FLOW FOR IOS
            ══════════════════════════════════════════════════════════════════════ */}
        <div className="w-full text-left space-y-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider px-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>របៀបដំឡើង និងប្រើប្រាស់ (Step-by-Step) ៖</span>
          </div>

          {/* STEP 1: Install Expo Go on iOS App Store */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-cyan-500/30 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 text-xs font-black flex items-center justify-center">
                  1
                </span>
                <span className="text-xs font-bold text-white">ដំឡើងកម្មវិធី Expo Go</span>
              </div>
              <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30">
                ជំហានទី ១
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ទាញយកកម្មវិធី Expo Go ពី Apple App Store (ឥតគិតថ្លៃ) ៖
            </p>
            <a
              href={IOS_APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition-all hover:border-cyan-400/50 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <AppleIcon className="w-4 h-4 text-cyan-400" />
                <span>ទាញយក Expo Go លើ App Store</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>

          {/* STEP 2: Open CAM ID in Expo Go */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-blue-500/30 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-bold text-white">បើកដំណើរការ CAM ID</span>
              </div>
              <span className="text-[10px] text-blue-400 font-semibold bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-500/30">
                ជំហានទី ២
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              បន្ទាប់ពីដំឡើង Expo Go រួច ចុចប៊ូតុងខាងក្រោមដើម្បីបើក App CAM ID លើ iPhone ៖
            </p>
            <button
              type="button"
              onClick={handleOpenExpo}
              className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
            >
              <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>⚡ បើកដំណើរការ CAM ID ក្នុង Expo Go</span>
            </button>
          </div>

          {/* STEP 3: Add to Home Screen via WebClip */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 text-xs font-black flex items-center justify-center">
                  3
                </span>
                <span className="text-xs font-bold text-white">ដាក់ Icon លើ Home Screen</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold bg-slate-900 px-2 py-0.5 rounded-md border border-white/10">
                ជំហានទី ៣
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              ដំឡើង WebClip Profile ដើម្បីដាក់ Icon CAM ID លើអេក្រង់ដើម iPhone ៖
            </p>
            <button
              type="button"
              onClick={handleInstallWebClip}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-cyan-400" />
              <span>📱 ដាក់ Icon CAM ID លើ iPhone Home Screen</span>
            </button>
          </div>
        </div>

        {/* Footer Security Badge */}
        <div className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Lock className="w-3 h-3 text-cyan-400" />
          <span>Apple TrueDepth 3D Biometrics • Zero-Password Login</span>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════
          ⚠️ PLATFORM MISMATCH WARNING MODAL (ANDROID DETECTED ON IOS PAGE)
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isAndroidDevice && showMismatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-500/40 p-6 shadow-2xl text-center space-y-4"
            >
              {/* Pulsing Warning Icon */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 relative">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              </div>

              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 uppercase tracking-wider">
                  ⚠️ Platform Mismatch Detected
                </span>
                <h3 className="text-lg font-bold text-white mt-2">
                  អ្នកមិនមែនប្រើទូរស័ព្ទ Apple iOS ទេ!
                </h3>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  ប្រព័ន្ធបានរកឃើញថាអ្នកកំពុងប្រើប្រាស់ទូរស័ព្ទ <strong className="text-emerald-400">Android</strong> ប៉ុន្តែបានស្កេន QR សម្រាប់ <strong>Apple iOS (iPhone)</strong>។
                </p>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  ដើម្បីទាញយក Package Kit (.apk) ឬ Expo Go សម្រាប់ Android បានត្រឹមត្រូវ សូមប្តូរទៅកាន់ទំព័រ Android ៖
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/download/android")}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <AndroidIcon className="w-4 h-4 text-slate-950" />
                  <span>🤖 ផ្លាស់ប្តូរទៅទំព័រ Android វិញ (Switch)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "https://www.google.com";
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  ចាកចេញ (Dismiss)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
