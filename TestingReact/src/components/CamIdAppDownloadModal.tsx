"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Smartphone,
  Download,
  QrCode,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  Globe,
  ArrowRight,
  Layers,
} from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";

interface CamIdAppDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: "en" | "km";
}

const DIRECT_APK_DOWNLOAD_URL = "https://expo.dev/artifacts/eas/DFw23DwmpdiwznK0DyVOmz3rvIciSeYchMwS3EKHM_U.apk";
const EXPO_CLOUD_APP_URL = "exp://u.expo.dev/cacb17a6-21d6-4b45-abf1-aab99521f61e?channel-name=master";

export default function CamIdAppDownloadModal({
  isOpen,
  onClose,
  lang = "km",
}: CamIdAppDownloadModalProps) {
  const [activeTab, setActiveTab] = useState<"android" | "ios">("android");
  const [apkQrUrl, setApkQrUrl] = useState<string>("");
  const [cloudQrUrl, setCloudQrUrl] = useState<string>("");
  const [hasCopied, setHasCopied] = useState<boolean>(false);

  // Generate QR Codes
  useEffect(() => {
    QRCode.toDataURL(DIRECT_APK_DOWNLOAD_URL, {
      width: 240,
      margin: 1.5,
      color: { dark: "#090d16", light: "#ffffff" },
    })
      .then(setApkQrUrl)
      .catch(() => {});

    QRCode.toDataURL(EXPO_CLOUD_APP_URL, {
      width: 240,
      margin: 1.5,
      color: { dark: "#090d16", light: "#ffffff" },
    })
      .then(setCloudQrUrl)
      .catch(() => {});
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    toast.success(lang === "km" ? "បានចម្លង Link រួចរាល់!" : "Link copied to clipboard!");
    setTimeout(() => setHasCopied(false), 3000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-slate-900 border border-white/15 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85)] p-5 sm:p-7 overflow-hidden z-10 text-slate-100"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start justify-between mb-5 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      CAM ID Mobile App
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                      v1.0.1 Live
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {lang === "km"
                      ? "កម្មវិធីស្កេនមុខ 3D និង Pair ចូលប្រើប្រព័ន្ធដោយស្វ័យប្រវត្តិ"
                      : "Face Biometrics & Companion Instant Desktop Authenticator"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 border border-white/10 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setActiveTab("android")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "android"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🤖 Android (.apk / Expo)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("ios")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === "ios"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>🍏 Apple iOS (iPhone)</span>
              </button>
            </div>

            {/* Tab 1: Android */}
            {activeTab === "android" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 border border-emerald-500/20 rounded-2xl p-4">
                  {apkQrUrl ? (
                    <div className="p-2.5 bg-white rounded-2xl shrink-0 shadow-lg ring-2 ring-emerald-500/20">
                      <img src={apkQrUrl} alt="Android APK QR" className="w-28 h-28" />
                    </div>
                  ) : null}

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>{lang === "km" ? "ណែនាំសម្រាប់ Android" : "Recommended for Android"}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      {lang === "km" ? "ទាញយក File CAM_ID.apk ផ្ទាល់" : "Download Standalone CAM_ID.apk"}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {lang === "km"
                        ? "ដំឡើងលើទូរស័ព្ទ Android (Samsung, OPPO, Xiaomi, Google Pixel...) ដើម្បីប្រើប្រាស់បានរលូន និងមាន Logo លើ Home Screen!"
                        : "Install directly on any Android device with full native performance and dedicated launcher icon."}
                    </p>

                    <a
                      href={DIRECT_APK_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>{lang === "km" ? "ទាញយក APK (v1.0.1)" : "Download APK (v1.0.1)"}</span>
                    </a>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded-xl p-3 border border-white/5 space-y-1">
                  <p className="font-semibold text-slate-300">
                    {lang === "km" ? "💡 របៀបដំឡើងលើ Android ៖" : "💡 Android Install Steps:"}
                  </p>
                  <p>1. {lang === "km" ? "ចុចទាញយក File .apk រួចបើក File នោះ" : "Download and open the APK file"}</p>
                  <p>2. {lang === "km" ? "ជ្រើសរើស 'Install' (ប្រសិនបើសួរ ចុច Allow from this source)" : "Click 'Install' (Allow unknown sources if prompted)"}</p>
                  <p>3. {lang === "km" ? "បើក App CAM ID រួចស្កេន QR Code លើកុំព្យូទ័រដើម្បី Pair!" : "Open CAM ID and scan pairing QR code on PC!"}</p>
                </div>
              </motion.div>
            )}

            {/* Tab 2: iOS */}
            {activeTab === "ios" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-4">
                  {cloudQrUrl ? (
                    <div className="p-2.5 bg-white rounded-2xl shrink-0 shadow-lg ring-2 ring-cyan-500/20">
                      <img src={cloudQrUrl} alt="iOS Cloud QR" className="w-28 h-28" />
                    </div>
                  ) : null}

                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>{lang === "km" ? "ដំណើរការលឿនលើ iPhone" : "Instant Launch on iPhone"}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      {lang === "km" ? "បើកដំណើរការលើ iPhone (Expo Go Cloud)" : "Open on iPhone via Expo Go"}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {lang === "km"
                        ? "ស្កេន QR Code នេះជាមួយកាមេរ៉ា iPhone របស់អ្នក ឬដំឡើង Icon CAM ID ទៅលើ Home Screen!"
                        : "Scan this QR code with your iPhone Camera or install the 1-tap Home Screen WebClip."}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <a
                        href="/api/camid-profile"
                        className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] cursor-pointer"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>{lang === "km" ? "ដាក់ Icon លើ Home Screen" : "Add to Home Screen"}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => copyLink(EXPO_CLOUD_APP_URL)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                      >
                        {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{lang === "km" ? "ចម្លង Cloud Link" : "Copy Link"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/40 rounded-xl p-3 border border-white/5 space-y-1">
                  <p className="font-semibold text-slate-300">
                    {lang === "km" ? "💡 របៀបប្រើប្រាស់លើ iPhone ៖" : "💡 iPhone Setup Steps:"}
                  </p>
                  <p>1. {lang === "km" ? "បើកកាមេរ៉ា iPhone ស្កេនលើ QR Code ខាងលើ" : "Open iPhone camera and scan the QR code above"}</p>
                  <p>2. {lang === "km" ? "ចុចលើពាក្យ 'Open in Expo Go' ដើម្បីបើក App" : "Tap 'Open in Expo Go' to launch CAM ID"}</p>
                  <p>3. {lang === "km" ? "រួចស្កេន Pairing QR លើកុំព្យូទ័រដើម្បីប្រើប្រាស់ Face Login!" : "Scan desktop Pairing QR to link Face Login!"}</p>
                </div>
              </motion.div>
            )}

            {/* Footer Direct Portal Link */}
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
              <a
                href="/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-semibold hover:underline"
              >
                <span>{lang === "km" ? "បើកទំព័រ Download Portal ពេញលេញ" : "Open Full Download Portal"}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors cursor-pointer"
              >
                {lang === "km" ? "បិទ" : "Close"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
